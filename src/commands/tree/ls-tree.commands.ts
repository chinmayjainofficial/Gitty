import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";

function getType(mode: string): string {
    if (mode === "40000") return "tree";
    if (mode === "160000") return "commit";
    return "blob";
}

/*
prints the following file details in given format (if --name-only flag is not passed)
fileMode objectType(blob/tree) shaHash filename/foldername
*/
export function lsTreeCmd(
    hashCode: string | undefined,
    flag: boolean,
    flagType: string // --name-only flag
) {
    try {
        if (!hashCode)
            throw new Error(
                `usage: git ls-tree [<options>] <tree-ish> [<path>...]\n\n\t--name-only\tlist only filenames\n`
            );
        if (flag && flagType !== "--name-only")
            throw new Error(`fatal: Not a valid object name ${flagType}`);

        const folder = hashCode.slice(0, 2);
        const file = hashCode.slice(2);
        const filePath = path.join(
            process.cwd(),
            ".git",
            "objects",
            folder,
            file
        );

        if (!fs.existsSync(filePath))
            throw new Error(`fatal: not a tree object`);

        const output = zlib.inflateSync(fs.readFileSync(filePath));

        // header: "tree <size>\0"
        const headerEnd = output.indexOf(0);
        if (!output.subarray(0, headerEnd).toString().startsWith("tree "))
            throw new Error(`fatal: not a tree object`);

        let i = headerEnd + 1;
        while (i < output.length) {
            const spaceIdx = output.indexOf(0x20, i);
            const nullIdx = output.indexOf(0, spaceIdx);

            const mode = output.subarray(i, spaceIdx).toString();
            const name = output.subarray(spaceIdx + 1, nullIdx).toString();
            const sha = output
                .subarray(nullIdx + 1, nullIdx + 21)
                .toString("hex");

            i = nullIdx + 21;

            if (flag) process.stdout.write(`${name}\n`);
            else
                process.stdout.write(
                    `${mode.padStart(6, "0")} ${getType(mode)} ${sha}\t${name}\n`
                );
        }
    } catch (error) {
        process.stderr.write((error as Error).message + "\n");
        process.exit(1);
    }
}
