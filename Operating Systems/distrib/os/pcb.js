var TSOS;
(function (TSOS) {
    class PCB {
        pid;
        pc;
        acc;
        xReg;
        yReg;
        zFlag;
        base;
        limit;
        state;
        priority;
        quantum;
        segment;
        location;
        waitTime;
        turnaroundTime;
        swapTSB;
        isOnDisk;
        constructor(pid = 0, base = 0, limit = 0, pc = 0, acc = 0, xReg = 0, yReg = 0, zFlag = 0, state = "New", priority = 0, quantum = 0, segment, location = "Memory", waitTime = 0, turnaroundTime = 0, swapTSB = null, isOnDisk = false) {
            this.pid = pid;
            this.pc = pc;
            this.acc = acc;
            this.xReg = xReg;
            this.yReg = yReg;
            this.zFlag = zFlag;
            this.base = base;
            this.limit = limit;
            this.state = state;
            this.priority = priority;
            this.quantum = quantum;
            this.segment = segment ?? Math.floor(base / PARTITION_SIZE);
            this.location = location;
            this.waitTime = waitTime;
            this.turnaroundTime = turnaroundTime;
            this.swapTSB = swapTSB;
            this.isOnDisk = isOnDisk;
        }
    }
    TSOS.PCB = PCB;
    // https://stackoverflow.com/questions/74605767/where-does-pcb-of-a-process-lies-inside-the-main-memory
    // https://stackoverflow.com/questions/55077013/process-table-in-operating-system
})(TSOS || (TSOS = {}));
//# sourceMappingURL=pcb.js.map