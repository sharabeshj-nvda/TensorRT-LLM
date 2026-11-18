<!-- Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
# Feature: Restore a pull request's archived specifications

Status: Draft demonstration acceptance plan

This pull request exercises specification archival for a real GitHub review.
It changes review documents only; TensorRT-LLM inference behavior is unchanged.
These documents use Spec Kit conventions and were authored without invoking
the Spec Kit CLI.

## User story

As a reviewer or returning author, I want to find a pull request's specification
and restore it beside the relevant code after transient review files are removed.

## Acceptance scenarios

1. Given a draft pull request with these documents, when the trusted archival
   workflow runs, its archive contains `spec-manifest.json` and all three files.
   Metadata identifies the actual repository, PR number and source head.
2. Given the archived draft, when the PR becomes ready for review, the workflow
   verifies archival before removing transient spec changes. An upload failure
   prevents removal.
3. Given a fresh checkout and the reader's own Artifactory credentials, when
   `git spec list --pr <PR>` runs, it finds this PR by its archived metadata.
4. When `git spec pull <PR>` runs, it verifies the compressed checksum and
   restores this spec, its plan and tasks. Restored untracked files are excluded
   through Git's local exclude file.
5. Given an edited restored spec, another pull refuses to overwrite the edit.
6. Given two archived source versions, `git spec diff <PR>` reports their
   document changes. The catalog groups both versions under the same PR.

## Boundaries

Keep this PR in draft until the uploader is configured and the first archive
is verified. CI credentials stay in secrets; each CLI user uses their own
credential. Dashboard hosting must enforce the archives' readership before
exported content is published. Files already tracked by an old Git commit
remain tracked; local exclusions do not untrack them.

## Completion evidence

Record the real PR URL, two source heads, archive paths/checksums, workflow
result, successful restoration and local-edit refusal in the PR description.
The acceptance scenarios above remain pending until that evidence exists.
