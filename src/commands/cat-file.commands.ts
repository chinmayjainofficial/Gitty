import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function flagValidation(flag: string): boolean {
    if (flag != "-s" && flag != "-p" && flag != "-t") return false;
    return true;
}

/*
1. locate the file (complete objPath)
2. read the fileContent present inside it
3. decompress the fileContent (gets bufferData)
4. fetch the header content using separator in bufferData
5. splits fileType and fileSize from header
6. according to the flags display the content
*/

// NOTE: cat-file command works with commitHash only not with hash-object hash, although both are same but file needs to be committed before executing cat-file command
export function catFile(commitHash: string, flag: string) {
    try {
        if (!flagValidation(flag))
            throw new Error(`error: unknown switch ${flag}`);

        const dirname = commitHash.slice(0, 2);
        const filename = commitHash.slice(2);
        // TODO: replace path of .git/ commit with .gitty/ commits
        const objDir = path.join(process.cwd(), ".gitty", "objects", dirname);
        const objPath = path.join(objDir, filename);
        if (!fs.existsSync(objPath))
            throw new Error(`fatal: Not a valid object name ${commitHash}`);
        const fileContent = fs.readFileSync(objPath);
        const bufferData = zlib.inflateSync(fileContent);
        // from the blob object fetch the required header content
        const nul = bufferData.indexOf(0); // \0 separator
        const header = bufferData.subarray(0, nul).toString();
        const [fileType, fileSize] = header.split(" ");
        // flags
        if (flag == "-p") process.stdout.write(bufferData.subarray(nul + 1));
        else if (flag == "-s") {
            if (!fileSize)
                throw new Error(`Cannot fetch the file size ${fileSize}`);
            process.stdout.write(fileSize + "\n");
        } else if (flag == "-t") {
            if (!fileType)
                throw new Error(`Cannot fetch the fileType ${fileType}`);
            process.stdout.write(fileType + "\n");
        }
    } catch (error) {
        process.stderr.write((error as Error).message + "\n");
        process.exit(1);
    }
}
