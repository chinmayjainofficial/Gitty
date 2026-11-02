import fs from "node:fs";
import path from "node:path";
import { hashObject } from "./src/fileOperations/hashObject.fileOperations";
import { initRepo, catFile, addFile } from "./src/commands/index.commands";
import {
    lsTreeCmd,
    writeTreeCmd,
    commitTreeCmd,
} from "./src/commands/tree/index.tree";

// fetch gitty command by destructuring it
const [, , command, ...args] = process.argv;

const WORK_DIR = process.cwd();
const GIT_DIR = path.join(WORK_DIR, ".gitty");

switch (command) {
    case "init": {
        initRepo(GIT_DIR);
        break;
    }
    case "hash-object": {
        const writeFlag = args.includes("-w");
        const filePath = args.find((arg) => arg !== "-w");
        const hashCode: string | null = hashObject(
            GIT_DIR,
            WORK_DIR,
            filePath,
            writeFlag
        );
        if (hashCode !== null) process.stdout.write(`${hashCode}\n`);
        break;
    }
    case "cat-file": {
        const flag = args[0];
        const commitHash = args[1];
        if (!commitHash && !flag) {
            process.stdout.write(
                `gitty cat-file: usage is to reads an object out of Gitty’s database and shows it to you`
            );
            throw new Error(
                `fatal: only two arguments allowed in <type> <object> mode`
            );
        }
        if (!commitHash || !flag) {
            process.stdout.write(
                `gitty cat-file: usage is to reads an object out of Gitty’s database and shows it to you`
            );
            throw new Error(
                `fatal: only two arguments allowed in <type> <object> mode, not 1`
            );
        }
        catFile(commitHash, flag);
        break;
    }
    case "write-tree": {
        const sha = writeTreeCmd();
        if (sha) process.stdout.write(`${sha}\n`);
        break;
    }
    case "add": {
        const paths: string[] = process.argv.slice(3);
        addFile(GIT_DIR, WORK_DIR, paths);
        break;
    }
    case "ls-tree": {
        let inputArgs: string[] = process.argv.slice(3);
        const inputArgsSize = inputArgs.length;
        if (
            (inputArgsSize > 1 && inputArgs[0] !== "--name-only") ||
            inputArgsSize > 2
        )
            break;
        let shaCode: string | undefined = inputArgs[0];
        if (inputArgsSize == 2) shaCode = inputArgs[1];
        if (inputArgsSize <= 1) lsTreeCmd(shaCode, false, "");
        else if (inputArgsSize === 2 && inputArgs[0] === "--name-only")
            lsTreeCmd(shaCode, true, inputArgs[0]);

        break;
    }
    case "commit-tree": {
        const args = process.argv.slice(3);
        const treeShaCode = args[0];
        const pIdx = args.indexOf("-p");
        const mIdx = args.indexOf("-m");
        const parentShaCode = pIdx !== -1 ? args[pIdx + 1] : undefined;
        const commitMessage = mIdx !== -1 ? args[mIdx + 1] : undefined;

        const isSha = (s?: string) => !!s && /^[0-9a-f]{40}$/.test(s);
        function objectExists(sha: string) {
            fs.existsSync(
                path.join(
                    process.cwd(),
                    ".gitty",
                    "objects",
                    sha.slice(0, 2),
                    sha.slice(2)
                )
            );
        }
        function fail(msg: string) {
            process.stderr.write(`commit-tree: ${msg}\n`);
            process.exit(1);
        }

        if (!isSha(treeShaCode))
            fail("a valid 40-character tree SHA is required");
        // @ts-ignore
        if (!objectExists(treeShaCode))
            fail(`tree ${treeShaCode} does not exist`);

        if (pIdx !== -1) {
            if (!isSha(parentShaCode))
                fail("-p requires a valid 40-character SHA");
            // @ts-ignore
            if (!objectExists(parentShaCode!))
                fail(`parent ${parentShaCode} does not exist`);
        }

        if (mIdx !== -1 && (!commitMessage || commitMessage.startsWith("-")))
            fail("-m requires a message");

        commitTreeCmd(treeShaCode, parentShaCode, commitMessage as string);
        break;
    }
    default: {
        throw new Error(`error: unknown command: ${command}`);
    }
}
