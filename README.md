# Gitty

Gitty is a small, educational version-control-system implementation written
in TypeScript and run with Bun. It explores how a repository can represent
file contents, directory snapshots, staged paths, and commit metadata using
content-addressed objects.

This README is a standalone project overview and local setup guide. It
describes the features currently implemented under `src/`; it does not claim
that Gitty implements every Git feature or that all command paths are
production-ready.

## What is version control?

Version control records changes to files over time so that different states
of a project can be identified and revisited. A version-control system needs
to represent project contents and organize those contents into snapshots.
History can then connect one snapshot to another.

Gitty implements core pieces of this model:

- **Blob objects** hold file bytes.
- **Tree objects** describe directory entries and refer to blobs or child
  trees.
- **Commit objects** can describe a tree, parent commit, author, committer,
  timestamp, and message.
- **Content-derived IDs** identify serialized objects using SHA-1.
- **A staging index** records paths, modes, and blob IDs when files are added.
- **Repository metadata** stores objects, references, and `HEAD` under
  `.gitty/`.

These are version-control concepts because they let the program identify file
content, represent a project state, and provide structures for connecting
states through commits. However, the current tree-building path reads directly
from the working directory rather than from the staging index, and the regular
commit implementation is not wired to the CLI. See
[Current scope and limitations](#current-scope-and-limitations).

## How Gitty relates to Git

Gitty is inspired by Git's object model and command names, but it is a
separate, limited implementation:

| Area | Gitty | Git |
|---|---|---|
| Repository metadata | Uses `.gitty/` | Uses `.git/` |
| Object model | Implements blob, tree, and commit constructors | Provides a complete, mature object and repository model |
| Object identifiers | Hashes serialized objects with SHA-1 | Uses SHA-1 in many existing repositories and supports SHA-256 repositories |
| Staging | `add` writes a JSON index and blob objects | The index is integrated with Git's broader staging and commit workflows |
| Tree snapshots | Current builder scans the working directory directly | Commits normally record the staged index snapshot |
| Commands | Implements a small subset with known limitations | Provides extensive local, remote, history, merge, and inspection workflows |

Gitty does not invoke Git internally and does not modify a `.git/` repository.
Its `.gitty/` data is not a drop-in replacement for Git metadata. Some command
names resemble Git commands to make the underlying ideas familiar; matching
names do not imply matching behavior.

## Requirements

- [Bun](https://bun.sh/) to install dependencies and run the TypeScript entry
  point.
- Git is optional and is only needed if you choose to clone the source
  repository with Git.

Check that Bun is available:

```sh
bun --version
```

## Set up the project locally

### 1. Get the source

Clone the repository:

```sh
git clone <repository-url>
cd Gitty
```

Alternatively, download and extract the source archive, then open a terminal
in the project directory.

### 2. Install dependencies

```sh
bun install
```

### 3. Run Gitty

Commands are run from the project directory or another directory where you
want Gitty to operate. For example, initialize a `.gitty` repository in the
current directory:

```sh
bun run index.ts init
```

The package also defines a `gitty` Bun script. The direct entry-point form
above makes the CLI invocation explicit.

## Quick start

The following demonstrates the implemented initialization, blob hashing,
staging, and tree snapshot flows:

```sh
bun run index.ts init

printf "Hello, Gitty!\n" > hello.txt

# Calculate a blob ID without writing the object
bun run index.ts hash-object hello.txt

# Calculate the ID and store the blob object
bun run index.ts hash-object -w hello.txt

# Add the file to the staging index
bun run index.ts add hello.txt

# Build a tree snapshot from the current working directory
bun run index.ts write-tree
```

`write-tree` reads the working directory directly; it does not use the index
created by `add`. The tree may therefore reflect working-directory contents
that have not been staged.

## Implemented command surface

Commands are invoked through `index.ts`:

| Command | Current behavior |
|---|---|
| `init` | Creates `.gitty/objects`, `.gitty/refs/heads`, and an initial `HEAD` pointing symbolically to `refs/heads/main` when `HEAD` does not already exist. |
| `hash-object <path>` | Constructs a blob from the file and prints its SHA-1 object ID without storing it. |
| `hash-object -w <path>` | Constructs and stores the compressed blob, then prints its ID. |
| `add <path> [<path> ...]` | Recursively stages files into `.gitty/index` and writes their blob objects. |
| `write-tree` | Recursively snapshots eligible working-directory files and prints the root tree ID when non-empty. |
| `ls-tree <tree-id>` | Intended to list a tree's direct entries. Currently looks in `.git/objects`, unlike Gitty's writers. |
| `ls-tree --name-only <tree-id>` | Intended to print only entry names; subject to the same object-directory mismatch. |
| `cat-file -p <object-id>` | Intended to print an object's payload; subject to the same object-directory mismatch. |
| `cat-file -s <object-id>` | Intended to print the size in an object's header; subject to the same object-directory mismatch. |
| `cat-file -t <object-id>` | Intended to print an object's type; subject to the same object-directory mismatch. |
| `commit-tree <tree-id> -p <parent-id> -m <message>` | Intended to create a commit object, but the CLI currently rejects object IDs because its object-existence helper does not return the filesystem check result. |

The `commitCmd` implementation in `src/commands/commit-file.commands.ts`
contains a regular commit workflow, but `index.ts` does not dispatch a
`commit` command to it. It is therefore not currently available as a working
CLI command.

## Repository data at a glance

After initialization and use, the metadata directory may contain:

```text
.gitty/
├── HEAD
├── index
├── objects/
│   └── <two-character-prefix>/
│       └── <remaining-object-id>
└── refs/
    └── heads/
```

- `HEAD` initially contains `ref: refs/heads/main`.
- `index` is JSON written by the `add` command.
- `objects/` contains zlib-compressed object data, addressed by object ID.
- `refs/heads/` is prepared for branch pointers; initialization does not
  create a `main` branch pointer.

## Current scope and limitations

- The staging index and tree snapshots are separate: `add` updates the index,
  but `write-tree` scans the working directory instead.
- The tree builder skips entries named `.gitty` and `node_modules`, includes
  other eligible files (including hidden files), and omits empty directories.
- The `add` traversal skips `.git` and `.gitty`; it does not apply ignore
  rules.
- The regular commit implementation is not connected to the CLI, and its
  current object-writing call does not match the helper signature.
- The `commit-tree` dispatcher has a broken object-existence check and its
  handler requires a parent commit.
- `cat-file` and `ls-tree` look in `.git/objects`, while object writers store
  data in `.gitty/objects`; these commands therefore do not normally inspect
  objects created by Gitty.
- `statusCmd` and `logCmd` are empty. Tag operations, remotes, push/pull,
  merge, diff, and conflict resolution are not implemented as complete
  workflows.
- No test, build, or lint scripts are currently defined in `package.json`.

Gitty is an educational project and should not be used as a replacement for
Git for important source history or data.

## Project layout

```text
index.ts                    CLI entry point
src/
├── commands/                Repository and command workflows
├── fileOperations/          File-to-object operations
├── objects/                 Blob, tree, commit, and object storage logic
└── utils/hashing/           Object hashing helper
Documentation/               Detailed implementation guides
```

## Detailed documentation

This README is intended to stand on its own for project setup and orientation.
For implementation details, see the focused guides in [`Documentation/`](Documentation/):

- [Concepts overview](Documentation/ConceptsOfGit.md)
- [Command guides](Documentation/commands/)
- [Concept guides](Documentation/concepts/)
- [Object guides](Documentation/gittyObjects/)

## License

No license is currently declared in `package.json`. Check with the project
maintainer before redistributing or reusing this code.
