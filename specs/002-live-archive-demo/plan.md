<!-- Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
# Plan: Exercise the existing archive contract on a real GitHub PR

1. Land the archive-before-removal integration on the demonstration fork's
   default branch using the repository's configured scans and normal review.
2. Configure the Artifactory URL, generic repository and writer secret for its
   trusted workflow. Verify runner connectivity before enabling uploads.
3. Open this branch as a draft PR against the fork's default branch. The
   workflow reads inert documents through GitHub APIs without executing PR code.
4. Verify that the manifest's PR/head/base identity matches GitHub and that
   Artifactory properties repeat the finalized descriptor metadata.
5. Change one task on this branch to produce a second archived version. Check
   the immutable archive paths and the stable `latest.json` pointer.
6. Use the standalone command from a fresh checkout to list, restore and diff
   the real PR. Verify the restored bytes and refusal after a local edit.
7. Mark the PR ready only after those checks pass. Verify archive-before-removal
   behavior separately from retrieval, retaining both archived versions.

The archive layout, checksum treatment and path checks are implemented by the
shared tools; this PR does not introduce another archive format or database.
OpenSpec uses the same metadata with `openspec/changes/` as its transient root.
