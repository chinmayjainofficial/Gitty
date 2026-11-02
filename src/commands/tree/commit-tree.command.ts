import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";
import { commitObject } from "../../objects/index.objects";
import { hashFileObject } from "../../utils/hashing/hashFileObject.utils";

export function commitTreeCmd(
    treeShaCode: string | undefined,
    parentShaCode: string | undefined,
    commitMessage: string | undefined
) {
    try {
        if (!treeShaCode) throw new Error("commit-tree: tree SHA is required");
        if (!parentShaCode)
            throw new Error(`commit-tree: tree parent SHA is required`);
        if (!commitMessage)
            throw new Error("commit-tree: commit message is required");

        const timestamp = `${Math.floor(Date.now() / 1000)} +0000`;
        const commitContentBuffer = Buffer.concat([
            Buffer.from(`tree ${treeShaCode}\n`),
            Buffer.from(`parent ${parentShaCode}\n`),
            Buffer.from(
                `author Authorname <authoremailid@gmail.com> ${timestamp}\n`
            ),
            Buffer.from(
                `committer Authorname <authoremailid@gmail.com> ${timestamp}\n\n`
            ),
            Buffer.from(`${commitMessage}\n`),
        ]);
        const obj = commitObject(commitContentBuffer);
        const hashCode = hashFileObject(obj);
        const folder = hashCode.slice(0, 2);
        const file = hashCode.slice(2);
        const folderPath = path.join(
            process.cwd(),
            ".gitty",
            "objects",
            folder
        );
        const filePath = path.join(folderPath, file);
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            fs.writeFileSync(filePath, zlib.deflateSync(obj));
        }
        process.stdout.write(`${hashCode}\n`);
        return;
    } catch (error) {
        process.stderr.write((error as Error).message + "\n");
        process.exit(1);
    }
}
