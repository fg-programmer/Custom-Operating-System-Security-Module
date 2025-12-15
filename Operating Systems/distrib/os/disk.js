var TSOS;
(function (TSOS) {
    class Disk extends TSOS.DeviceDriver {
        deviceName;
        tracks;
        sectors;
        blocks;
        blockSize = 64;
        hexBlockSize = this.blockSize * 2;
        directory = 0; // Track 0 = directory
        freeBlockMap;
        constructor(deviceName = "disk0", tracks = 4, sectors = 8, blocks = 8) {
            super();
            this.driverEntry = this.initDriver;
            this.deviceName = deviceName;
            this.tracks = tracks;
            this.sectors = sectors;
            this.blocks = blocks;
            // Build the array [track][sector][block]
            this.freeBlockMap = [];
            for (let t = 0; t < tracks; t++) {
                this.freeBlockMap[t] = [];
                for (let s = 0; s < sectors; s++) {
                    this.freeBlockMap[t][s] = new Array(blocks).fill(true);
                }
            }
        }
        initDriver() {
            this.status = "loaded";
        }
        format() {
            sessionStorage.clear();
            for (let t = 0; t < this.tracks; t++) {
                for (let s = 0; s < this.sectors; s++) {
                    for (let b = 0; b < this.blocks; b++) {
                        this.setBlock(t, s, b, "".padEnd(this.hexBlockSize, "0"));
                        this.freeBlockMap[t][s][b] = true;
                    }
                }
            }
            // Only reserve first block of directory track
            this.freeBlockMap[this.directory][0][0] = false;
        }
        formatQuick() {
            sessionStorage.clear();
            const firstFour = "0000";
            for (let t = 0; t < this.tracks; t++) {
                for (let s = 0; s < this.sectors; s++) {
                    for (let b = 0; b < this.blocks; b++) {
                        const key = `disk${t}_${s}${b}`;
                        let oldBlock = sessionStorage.getItem(key);
                        if (oldBlock === null)
                            oldBlock = "".padEnd(this.hexBlockSize, "0");
                        const newBlock = firstFour + oldBlock.slice(4);
                        this.setBlock(t, s, b, newBlock);
                        this.freeBlockMap[t][s][b] = true;
                    }
                }
            }
            // Only reserve first block of directory track
            this.freeBlockMap[this.directory][0][0] = false;
        }
        key(t, s, b) {
            return `${this.deviceName}_${t}${s}${b}`;
        }
        getBlock(t, s, b) {
            const k = this.key(t, s, b);
            const content = sessionStorage.getItem(k);
            if (content === null)
                throw new Error(`Missing disk block: ${k}`);
            return content;
        }
        setBlock(t, s, b, data) {
            if (data.length > this.hexBlockSize)
                throw new Error(`Data too large for block.`);
            const k = this.key(t, s, b);
            sessionStorage.setItem(k, data.padEnd(this.hexBlockSize, "0"));
        }
        allocateDBlock() {
            for (let t = 0; t < this.tracks; t++) {
                for (let s = 0; s < this.sectors; s++) {
                    for (let b = 0; b < this.blocks; b++) {
                        // Skip reserved directory block
                        if (t === 0 && s === 0 && b === 0)
                            continue;
                        if (this.freeBlockMap[t][s][b]) {
                            this.freeBlockMap[t][s][b] = false;
                            return [t, s, b];
                        }
                    }
                }
            }
            throw new Error("Disk full");
        }
        freeBlock(t, s, b) {
            this.freeBlockMap[t][s][b] = true;
        }
        createFile(filename) {
            const dir = this.findDirectory(filename);
            if (dir)
                return false; // file exists
            // Find empty directory block
            for (let s = 0; s < this.sectors; s++) {
                for (let b = 0; b < this.blocks; b++) {
                    const block = this.getBlock(this.directory, s, b);
                    if (block.startsWith("00")) {
                        // allocate the metadata block
                        const [dt, ds, db] = this.allocateDBlock();
                        const hexName = this.stringToHex(filename);
                        const header = "01" +
                            dt.toString(16).padStart(2, "0") +
                            ds.toString(16).padStart(2, "0") +
                            db.toString(16).padStart(2, "0");
                        const sizeHex = "0000";
                        const dateHex = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
                        const content = header + dateHex + sizeHex + hexName;
                        this.setBlock(this.directory, s, b, content);
                        return true;
                    }
                }
            }
            return false;
        }
        readFile(filename) {
            const entry = this.findDirectory(filename);
            if (!entry)
                throw new Error("File not found");
            const [t, s, b] = entry;
            const metadata = this.getBlock(t, s, b);
            const dt = parseInt(metadata.substring(2, 4), 16);
            const ds = parseInt(metadata.substring(4, 6), 16);
            const db = parseInt(metadata.substring(6, 8), 16);
            const fileBlock = this.getBlock(dt, ds, db);
            return this.hexToString(fileBlock);
        }
        writeFile(filename, data) {
            const entry = this.findDirectory(filename);
            if (!entry)
                throw new Error("File not found");
            const [dirTrack, dirSector, dirBlock] = entry;
            const old = this.getBlock(dirTrack, dirSector, dirBlock);
            const oldTrack = parseInt(old.substring(2, 4), 16);
            const oldSector = parseInt(old.substring(4, 6), 16);
            const oldBlock = parseInt(old.substring(6, 8), 16);
            // Clear old data chain if any
            if (!(oldTrack === 0 && oldSector === 0 && oldBlock === 0)) {
                try {
                    const { chain } = this.readSwap(oldTrack, oldSector, oldBlock);
                    for (const [t, s, b] of chain) {
                        this.freeBlock(t, s, b);
                        this.setBlock(t, s, b, "".padEnd(this.hexBlockSize, "0"));
                    }
                }
                catch {
                    try {
                        this.freeBlock(oldTrack, oldSector, oldBlock);
                        this.setBlock(oldTrack, oldSector, oldBlock, "".padEnd(this.hexBlockSize, "0"));
                    }
                    catch { }
                }
            }
            const textHex = this.stringToHex(data);
            if (textHex.length > this.hexBlockSize) {
                throw new Error("File too large for block");
            }
            const [t, s, b] = this.allocateDBlock();
            this.setBlock(t, s, b, textHex);
            const pointer = "01" +
                t.toString(16).padStart(2, "0") +
                s.toString(16).padStart(2, "0") +
                b.toString(16).padStart(2, "0");
            const dateHex = Math.floor(Date.now() / 1000)
                .toString(16)
                .padStart(8, "0");
            const sizeHex = (textHex.length / 2)
                .toString(16)
                .padStart(4, "0");
            const nameHex = old.substring(20);
            const newDir = pointer + dateHex + sizeHex + nameHex;
            this.setBlock(dirTrack, dirSector, dirBlock, newDir);
        }
        listFilesAll() {
            const files = [];
            for (let s = 0; s < this.sectors; s++) {
                for (let b = 0; b < this.blocks; b++) {
                    const block = this.getBlock(this.directory, s, b);
                    if (!block.startsWith("01"))
                        continue;
                    const dt = block.substring(2, 8);
                    if (dt == "000000")
                        continue;
                    const size = parseInt(block.substring(16, 20), 16);
                    const date = parseInt(block.substring(8, 16), 16);
                    const nameHex = block.substring(20).replace(/00+$/, "");
                    const name = this.hexToString(nameHex);
                    files.push({
                        name,
                        size,
                        date,
                        hidden: name.startsWith(".")
                    });
                }
            }
            return files;
        }
        findDirectory(filename) {
            const hexName = this.stringToHex(filename);
            for (let s = 0; s < this.sectors; s++) {
                for (let b = 0; b < this.blocks; b++) {
                    const raw = this.getBlock(this.directory, s, b);
                    if (raw.startsWith("01")) {
                        const storedName = raw.substring(20).replace(/00+$/, "");
                        if (storedName === hexName) {
                            return [this.directory, s, b];
                        }
                    }
                }
            }
            return null;
        }
        stringToHex(s) {
            let out = "";
            for (let c of s)
                out += c.charCodeAt(0).toString(16).padStart(2, "0");
            return out;
        }
        hexToString(hex) {
            let out = "";
            for (let i = 0; i < hex.length; i += 2) {
                const byte = hex.substring(i, i + 2);
                if (byte === "00")
                    break;
                out += String.fromCharCode(parseInt(byte, 16));
            }
            return out;
        }
        readSwap(t, s, b) {
            const chain = [];
            let fullHex = "";
            let currentT = t, currentS = s, currentB = b;
            const nextPointerLen = 6;
            const dataChunkLen = this.hexBlockSize - nextPointerLen;
            while (true) {
                const raw = this.getBlock(currentT, currentS, currentB);
                chain.push([currentT, currentS, currentB]);
                // First 6 chars = next pointer (t(2) s(2) b(2))
                const nextPtr = raw.substring(0, nextPointerLen);
                const chunk = raw.substring(nextPointerLen, nextPointerLen + dataChunkLen);
                fullHex += chunk;
                const nt = parseInt(nextPtr.substring(0, 2), 16);
                const ns = parseInt(nextPtr.substring(2, 4), 16);
                const nb = parseInt(nextPtr.substring(4, 6), 16);
                // terminator is 0,0,0
                if (nt === 0 && ns === 0 && nb === 0) {
                    break;
                }
                currentT = nt;
                currentS = ns;
                currentB = nb;
            }
            // Split fullHex into bytes (2 hex chars each)
            const bytes = [];
            for (let i = 0; i < fullHex.length; i += 2) {
                bytes.push(fullHex.substring(i, i + 2));
            }
            return { bytes, chain };
        }
        writeSwap(pid, data) {
            // Join bytes to a single hex string
            const hex = data.join("");
            const nextPointerLen = 6;
            const chunkLen = this.hexBlockSize - nextPointerLen; // how many hex chars per block for data
            const chunks = [];
            for (let i = 0; i < hex.length; i += chunkLen) {
                chunks.push(hex.slice(i, i + chunkLen));
            }
            // Allocate blocks for each chunk, rolling back if allocation fails
            const tsbs = [];
            try {
                for (let i = 0; i < chunks.length; i++) {
                    const [ct, cs, cb] = this.allocateDBlock();
                    tsbs.push([ct, cs, cb]);
                }
            }
            catch (err) {
                for (const [rt, rs, rb] of tsbs) {
                    this.freeBlock(rt, rs, rb);
                    this.setBlock(rt, rs, rb, "".padEnd(this.hexBlockSize, "0"));
                }
                throw err;
            }
            // Write each chunk with pointer to next
            for (let i = 0; i < tsbs.length; i++) {
                const [ct, cs, cb] = tsbs[i];
                let pointerHex;
                if (i < tsbs.length - 1) {
                    const [nt, ns, nb] = tsbs[i + 1];
                    pointerHex =
                        nt.toString(16).padStart(2, "0") +
                            ns.toString(16).padStart(2, "0") +
                            nb.toString(16).padStart(2, "0");
                }
                else {
                    pointerHex = "000000"; // terminator
                }
                const dataPart = chunks[i].padEnd(chunkLen, "0");
                const content = pointerHex + dataPart;
                this.setBlock(ct, cs, cb, content);
            }
            // Return head TSB
            const head = tsbs[0];
            return [head[0], head[1], head[2]];
        }
        deleteFile(filename) {
            const entry = this.findDirectory(filename);
            if (!entry)
                return false;
            const [t, s, b] = entry;
            const raw = this.getBlock(t, s, b);
            this.setBlock(t, s, b, "".padEnd(this.hexBlockSize, "0"));
            // Free the data block 
            const dt = parseInt(raw.substring(2, 4), 16);
            const ds = parseInt(raw.substring(4, 6), 16);
            const db = parseInt(raw.substring(6, 8), 16);
            this.freeBlock(dt, ds, db);
            this.setBlock(dt, ds, db, "".padEnd(this.hexBlockSize, "0"));
            return true;
        }
        listFiles() {
            const files = [];
            for (let s = 0; s < this.sectors; s++) {
                for (let b = 0; b < this.blocks; b++) {
                    const block = this.getBlock(this.directory, s, b);
                    if (block.startsWith("01")) {
                        const nameHex = block.substring(20).replace(/00+$/, "");
                        const filename = this.hexToString(nameHex);
                        if (filename.startsWith("."))
                            continue;
                        files.push(filename);
                    }
                }
            }
            return files;
        }
    }
    TSOS.Disk = Disk;
    // Used reference from chaOS, BrenDOS, and MarshOS in designing my disk and swapping.
    // Used MDN Web Docs for sessionStorage behavior
    // Used AI to help figure out why freeBlockMap wasn't updating after writes.
    // Used AI to help me understand why my date configuration was broken in ls -a
})(TSOS || (TSOS = {}));
//# sourceMappingURL=disk.js.map