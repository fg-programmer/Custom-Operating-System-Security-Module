var TSOS;
(function (TSOS) {
    class DiskDisplay {
        bodyRef;
        constructor() {
            this.bodyRef = document.getElementById("diskTableBody");
        }
        refresh() {
            if (!this.bodyRef)
                return;
            // Delete all the old rows
            this.bodyRef.innerHTML = "";
            const drv = _krnDiskDriver;
            for (let t = 0; t < drv.tracks; t++) {
                for (let s = 0; s < drv.sectors; s++) {
                    for (let b = 0; b < drv.blocks; b++) {
                        const tsbKey = `${drv.deviceName}_${t}${s}${b}`;
                        let raw = sessionStorage.getItem(tsbKey);
                        if (!raw) {
                            raw = "".padEnd(drv.hexBlockSize, "0");
                        }
                        const row = document.createElement("tr");
                        // TSB column
                        const tsbCell = document.createElement("td");
                        tsbCell.textContent = tsbKey;
                        const usedCell = document.createElement("td");
                        const allocated = raw.startsWith("01");
                        usedCell.textContent = allocated ? "✔" : "·";
                        usedCell.style.textAlign = "center";
                        // Next pointer
                        const nextCell = document.createElement("td");
                        const ptr = raw.substring(1, 7);
                        nextCell.textContent = `${ptr[0]}.${ptr[1]}.${ptr[2]}`;
                        const dataCell = document.createElement("td");
                        dataCell.textContent = raw.substring(8);
                        row.appendChild(tsbCell);
                        row.appendChild(usedCell);
                        row.appendChild(nextCell);
                        row.appendChild(dataCell);
                        this.bodyRef.appendChild(row);
                    }
                }
            }
        }
    }
    TSOS.DiskDisplay = DiskDisplay;
    // LegOS, MarshOS, and chaOS all helped me get an idea for what to do for this.
})(TSOS || (TSOS = {}));
//# sourceMappingURL=diskdisplay.js.map