// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// Copies the spec files a removal took out of a pull request to the artifact
// store, under <repository URL>/llm-artifacts/trtllm-pr-specs/github/<PR number>/<path under specs/>,
// beside the CI build artifacts and written with the same identity.
// Runs after the removal and its notice; a failure here is logged and changes
// nothing on the pull request. Files are read from the parent of the removal
// commit, which stays in the branch history.

const {mkdir, readFile, writeFile} = require('node:fs/promises');
const {dirname} = require('node:path');
const {isSpecPath, enumerateSpecBlobs} = require('./remove_ready_specs.js');

const ARCHIVE_PREFIX = 'llm-artifacts/trtllm-pr-specs';
const PLATFORMS = new Set(['github']);
const SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function archiveKey(platform, number) {
  if (!PLATFORMS.has(platform)) throw new Error(`Unknown platform ${JSON.stringify(platform)}`);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`Invalid PR number ${JSON.stringify(number)}`);
  return `${ARCHIVE_PREFIX}/${platform}/${number}`;
}

function archivePath(platform, number, specPath) {
  if (!isSpecPath(specPath)) throw new Error(`${JSON.stringify(specPath)} is not under specs/`);
  return [archiveKey(platform, number), ...specPath.split('/').slice(1).map(encodeURIComponent)].join('/');
}

// A removal is handed over only when it took out files present in the head.
// Otherwise there is nothing to copy, and the archive starts nothing on its
// self-hosted runner.
function shouldHandOver(result) {
  return result.outcome === 'removed' && result.paths.length > 0;
}

// The record the removal run hands over: identifiers and paths only.
function recordFor(platform, result) {
  return {
    platform, number: result.number, headRepository: result.headRepository,
    parentSha: result.parentSha, paths: result.paths,
  };
}

function parseRecord(text) {
  const record = JSON.parse(text);
  archiveKey(record.platform, record.number);
  if (!REPOSITORY.test(record.headRepository ?? '')) throw new Error('Invalid head repository in the record');
  if (!SHA.test(record.parentSha ?? '')) throw new Error('Invalid parent SHA in the record');
  if (!Array.isArray(record.paths) || !record.paths.every(isSpecPath)) throw new Error('Invalid paths in the record');
  return record;
}

async function writeRecord(path, record) {
  await mkdir(dirname(path), {recursive: true});
  await writeFile(path, JSON.stringify(record), 'utf8');
}

function authorization({user, token}) {
  return user ? `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}` : `Bearer ${token}`;
}

// API errors while listing the parent, and any failure to read or upload one
// file, are returned in `failed` for the caller to log. Anything else thrown
// while listing is a bug and propagates.
async function archiveSpecs({github, record, store, fetchImpl = fetch}) {
  const result = {uploaded: [], failed: []};
  const [owner, repo] = record.headRepository.split('/');
  let blobs;
  try {
    blobs = await enumerateSpecBlobs(github, {owner, repo, treeish: record.parentSha});
  } catch (error) {
    if (!Number.isInteger(error?.status)) throw error;
    result.failed.push({path: record.parentSha, error: `listing failed: ${error.message}`});
    return result;
  }
  const base = store.baseUrl.replace(/\/+$/, '');
  for (const path of record.paths) {
    try {
      const blob = blobs.get(path);
      if (!blob) throw new Error('not in the parent commit');
      const {data} = await github.rest.git.getBlob({owner, repo, file_sha: blob.sha});
      // A PUT over an existing path replaces it, which keeps one archive per PR.
      const response = await fetchImpl(`${base}/${archivePath(record.platform, record.number, path)}`, {
        method: 'PUT', headers: {Authorization: authorization(store)}, body: Buffer.from(data.content, 'base64'),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      result.uploaded.push(path);
    } catch (error) {
      result.failed.push({path, error: error.message});
    }
  }
  return result;
}

async function run({github, core, env = process.env, fetchImpl}) {
  if (!env.ARCHIVE_BASE_URL || !env.ARCHIVE_TOKEN) {
    core.warning('The artifact store credential is not configured (repository secret AWS_ARTIFACTORY_TOKEN); ' +
      'nothing was archived.');
    return;
  }
  const record = parseRecord(await readFile(env.RECORD_PATH, 'utf8'));
  const store = {baseUrl: env.ARCHIVE_BASE_URL, user: env.ARCHIVE_USER, token: env.ARCHIVE_TOKEN};
  const {uploaded, failed} = await archiveSpecs({github, record, store, fetchImpl});
  core.info(`Archived ${uploaded.length} file(s) under ${archiveKey(record.platform, record.number)}/`);
  for (const {path, error} of failed) core.warning(`Not archived: ${path}: ${error}`);
  if (failed.length) core.setFailed(`${failed.length} file(s) were not archived.`);
}

module.exports = {archiveKey, archivePath, shouldHandOver, recordFor, parseRecord, writeRecord, archiveSpecs, run};
