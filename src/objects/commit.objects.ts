export function commitObject(commitContent: Buffer): Buffer {
    const header = `commit ${commitContent.length}\0`;
    return Buffer.concat([Buffer.from(header), commitContent]);
}
