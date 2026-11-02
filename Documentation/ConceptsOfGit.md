# Gitty: Implemented Version-Control Concepts

This document explains how the version-control concepts currently implemented
in `src/` fit together. It describes Gitty as it exists in this repository,
not every feature or behavior of Git.

## Contents

- [Repository initialization](#repository-initialization)
- [The working directory, staging index, and snapshots](#the-working-directory-staging-index-and-snapshots)
- [Objects and content-addressed IDs](#objects-and-content-addressed-ids)
- [Blob objects](#blob-objects)
- [Tree objects and directory snapshots](#tree-objects-and-directory-snapshots)
- [Commit objects and references](#commit-objects-and-references)
- [Object lookup and inspection](#object-lookup-and-inspection)
- [Current implementation boundaries](#current-implementation-boundaries)
- [Further documentation](#further-documentation)

## Repository initialization

The `init` command creates a `.gitty` metadata directory in the current
working directory. The initializer ensures these paths exist:

```text
.gitty/
├── objects/
└── refs/
    └── heads/
```

If `.gitty/HEAD` does not already exist, it creates it with:

```text
ref: refs/heads/main
```

This makes `HEAD` a symbolic reference to the `main` branch, but initialization
does not create the branch pointer file itself. Re-running initialization
ensures the directories exist and preserves an existing `HEAD`; it does not
validate or repair repository metadata.

## The working directory, staging index, and snapshots

Gitty has two distinct representations of file state:

1. **The staging index** is a JSON file at `.gitty/index`. The `add` operation
   adds or replaces entries keyed by normalized repository-relative path.
   Each entry stores a mode and blob hash. Files with an executable bit are
   recorded as `100755`; other staged files are recorded as `100644`.
2. **A tree snapshot** stores directory entries that refer to blob and child
   tree objects.

The index is loaded as an empty object if it does not exist. When it is
written, its path keys are sorted. Adding a directory recursively stages its
files while skipping entries named `.git` and `.gitty`. The staging operation
does not apply ignore rules, remove index entries for deleted files, or stage
empty directories.

There is an important implementation distinction: the current `buildTree`
function reads the working directory directly and does not read the staging
index. It skips `.gitty` and `node_modules`, but not `.git`. It records regular
files as `100644` regardless of executable permissions. Consequently, a tree
snapshot may include unstaged filesystem changes and may differ from the
contents described by the staging index.

## Objects and content-addressed IDs

Gitty represents data using serialized objects. The implemented object
constructors create buffers for blobs, trees, and commits. An object's ID is
the SHA-1 digest of its complete serialized bytes, including its type and size
header.

For example, the file hashing path constructs a blob object first and hashes
that complete object, rather than hashing only the raw file content. Identical
serialized bytes produce the same ID, which allows object paths to be derived
from their content and existing objects to be reused.

When an object is written, Gitty zlib-compresses its serialized bytes and uses
the first two ID characters as a directory prefix:

```text
.gitty/objects/<first-two-id-characters>/<remaining-id-characters>
```

The hash is calculated from the uncompressed serialized object; compression
is used for storage. Object-writing helpers skip a write when the expected
object path already exists, but they do not verify the contents of that
existing file.

SHA-1 gives this implementation deterministic content-derived identifiers;
it should not be described as a guarantee of absolute uniqueness or as a
cryptographic security boundary. The object-reading code does not consistently
recompute IDs to validate object contents.

## Blob objects

A blob represents file bytes. Its serialized form is:

```text
blob <content-size-in-bytes>\0<content-bytes>
```

The blob includes the content's byte length and raw bytes. It does not contain
the file name, path, permissions, or timestamps. Those details are associated
with the blob by other structures, such as a tree entry or a staging-index
entry.

As a result, files with the same bytes can share a blob ID even when their
names or locations differ. The `hash-object` file operation can calculate
this ID without storing the blob, or with `-w` it can compress and write the
blob to the object directory.

## Tree objects and directory snapshots

A tree describes one directory level. It associates each included name and
mode with an object ID:

- File entries refer to blob objects.
- Directory entries refer to child tree objects.

The serialized tree contains a `tree <body-size>\0` header followed by entries
whose mode and name are text, followed by a null byte and the referenced
object ID as raw bytes. Program code represents IDs as hexadecimal strings;
the tree serializer converts them to bytes for storage in the tree.

`buildTree` traverses directories recursively, creating blobs for regular
files and child trees before their parent trees. It returns the root tree ID,
or `null` when the directory has no included entries. Empty directories are
therefore omitted. Entries are sorted by the tree serializer; directory names
use a trailing slash in the sort key, without changing the stored name.

The `write-tree` CLI operation starts this traversal at the current working
directory and prints the root ID when one exists. A tree is a snapshot of the
included filesystem state at construction time, not a live view.

## Commit objects and references

A commit object wraps commit content in this outer form:

```text
commit <content-size-in-bytes>\0<commit-content>
```

The commit content generated by the commit implementations includes a `tree`
line, an optional `parent` line, author and committer fields, a blank line,
and the commit message. The tree identifies the snapshot; parent references
connect commits into history.

The regular commit implementation in `src/commands/commit-file.commands.ts`
is written to build a tree from the working directory, read `HEAD` and any
current branch reference to find a parent, create a commit object, and update
the branch reference or detached `HEAD`. It allows a first commit without a
parent. Author and committer identity are currently hard-coded, and the
timestamp is generated when the commit is created.

However, `commitCmd` is not dispatched by the current top-level `index.ts`.
The code exists in `src/`, but there is no currently wired CLI command for
that regular commit flow. In addition, the local `writeObject` helper in that
file takes two arguments (`type` and `content`), while `commitCmd` calls it
with only the result of `commitObject`. The commit path therefore is not a
working end-to-end implementation as currently written.

The separate `commit-tree` command is wired into the CLI and is intended to
create a commit object from supplied tree, parent, and message values. Its
implementation requires all three values and writes the commit object without
updating `HEAD` or a branch. The CLI's `objectExists` helper currently does
not return the result of its filesystem check, so the dispatcher treats valid
object IDs as missing and rejects them before the commit handler runs.

## Object lookup and inspection

`cat-file` supports `-p`, `-s`, and `-t`: output the payload, report the size,
or report the type of an object. It reads a compressed object, inflates it,
and interprets the type and size from the header. It does not validate that
the object ID matches the object bytes or that the declared size matches the
payload.

`ls-tree` is intended to display the direct entries in a tree, optionally
printing names only. It assumes each referenced object ID is 20 bytes when
parsing entries.

Both `cat-file` and `ls-tree` currently look up objects under `.git/objects`,
while the implemented object writers store them under `.gitty/objects`.
Therefore, objects created by the normal Gitty writers are not found by these
readers unless they are also present at the `.git` path.

## Current implementation boundaries

The following features are not implemented as complete workflows in `src/`:

- `statusCmd` and `logCmd` are empty functions; there is no implemented status
  report or commit-history listing.
- The tag object module is empty; tag creation and lookup are not implemented.
- The tree-building path does not use staged index contents.
- The regular commit implementation is not wired to the CLI.
- The `commit-tree` CLI currently fails its object-existence checks.
- `cat-file` and `ls-tree` use an object directory different from the one used
  by writers.
- Remotes, fetching, pushing, merging, conflict resolution, diffs, and ignore
  rules are not implemented as working features.

## Further documentation

Detailed implementation documentation is available in:

- [Hashing concepts](./concepts/hashing.concepts.adoc)
- [Blob objects](./gittyObjects/blobObject.adoc)
- [Tree objects](./gittyObjects/treeObject.adoc)
- [Tree-building concepts](./concepts/buildTree.concepts.adoc)
- [Initialize repository command](./commands/init-repository.commands.adoc)
- [Add/staging command](./commands/add-file-staging-area.commands.adoc)
- [Tree commands](./commands/tree.commands.adoc)
- [Cat-file command](./commands/cat-file.commands.adoc)
- [Commit objects](./gittyObjects/commitObject.adoc)
