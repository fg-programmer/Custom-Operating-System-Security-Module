var TSOS;
(function (TSOS) {
    class Memory {
        size;
        memory;
        mar; // Address register (where in memory we’re looking)
        mdr; // Data register (what we’re reading/writing)
        constructor(size = MEMORY_SIZE) {
            this.size = size;
            this.memory = new Array(this.size).fill("00");
            this.mar = 0x0000;
            this.mdr = "00";
        }
        // Reset everything back to zeroed-out memory
        init() {
            this.memory.fill("00");
            this.mar = 0x0000;
            this.mdr = "00";
        }
        // MAR (address register)
        getMAR() {
            return this.mar;
        }
        setMAR(address) {
            if (address >= 0 && address < this.size) {
                this.mar = address;
            }
            else {
                throw new Error(`Invalid MAR value: ${address.toString(16)}`);
            }
        }
        // MDR (data register) 
        getMDR() {
            return this.mdr;
        }
        setMDR(data) {
            if (/^[0-9A-Fa-f]{1,2}$/.test(data)) {
                this.mdr = data.toUpperCase().padStart(2, "0");
            }
            else {
                throw new Error(`Invalid MDR value: ${data}`);
            }
        }
        // Going to make one memory bounds checking class instead of individually implementing
        enforceBounds(address) {
            if (!_CurrentPCB)
                return;
            const base = _CurrentPCB.base;
            const limit = _CurrentPCB.limit;
            if (address < base || address > limit) {
                throw new Error(`Memory Access Violation: ${address.toString(16)} out of bounds (${base.toString(16)}–${limit.toString(16)})`);
            }
        }
        // Normal memory ops (use MAR/MDR) 
        read() {
            this.enforceBounds(this.mar);
            if (this.mar >= 0 && this.mar < this.size) {
                this.mdr = this.memory[this.mar];
            }
            else {
                throw new Error(`Read failed - bad MAR: ${this.mar.toString(16)}`);
            }
        }
        write() {
            this.enforceBounds(this.mar);
            if (this.mar >= 0 && this.mar < this.size) {
                this.memory[this.mar] = this.mdr;
            }
            else {
                throw new Error(`Write failed - bad MAR: ${this.mar.toString(16)}`);
            }
        }
        // Direct access (skip MAR/MDR)
        readDirect(address) {
            if (address >= 0 && address < this.size) {
                return this.memory[address];
            }
            throw new Error(`Direct read failed - bad address: ${address.toString(16)}`);
        }
        writeDirect(address, data) {
            if (address >= 0 && address < this.size) {
                this.memory[address] = data.toUpperCase().padStart(2, "0");
            }
            else {
                throw new Error(`Direct write failed - bad address: ${address.toString(16)}`);
            }
        }
        // Debugging helper
        dump(start = 0x0000, end = 0x0010) {
            for (let i = start; i <= end; i++) {
                console.log(`Addr ${i.toString(16).padStart(4, "0")}: ${this.memory[i]}`);
            }
        }
    }
    TSOS.Memory = Memory;
})(TSOS || (TSOS = {}));
// Used my computer org and arch memory structure for most of the logic here.
// Same logic overall, but different implementation 
//# sourceMappingURL=Memory.js.map