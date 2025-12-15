/* ------------
     Control.ts

     Routines for the hardware simulation, NOT for our client OS itself.
     These are static because we are never going to instantiate them, because they represent the hardware.
     In this manner, it's A LITTLE BIT like a hypervisor, in that the Document environment inside a browser
     is the "bare metal" (so to speak) for which we write code that hosts our client OS.
     But that analogy only goes so far, and the lines are blurred, because we are using TypeScript/JavaScript
     in both the host and client environments.

     This (and other host/simulation scripts) is the only place that we should see "web" code, such as
     DOM manipulation and event handling, and so on.  (Index.html is -- obviously -- the only place for markup.)

     This code references page numbers in the text book:
     Operating System Concepts 8th edition by Silberschatz, Galvin, and Gagne.  ISBN 978-0-470-12872-5
     ------------ */
//
// Control Services
//
var TSOS;
(function (TSOS) {
    class Control {
        static hostInit() {
            // This is called from index.html's onLoad event via the onDocumentLoad function pointer.
            // Get a global reference to the canvas.  TODO: Should we move this stuff into a Display Device Driver?
            _Canvas = document.getElementById('display');
            // Get a global reference to the drawing context.
            _DrawingContext = _Canvas.getContext('2d');
            // Enable the added-in canvas text functions (see canvastext.ts for provenance and details).
            TSOS.CanvasTextFunctions.enable(_DrawingContext); // Text functionality is now built in to the HTML5 canvas. But this is old-school, and fun, so we'll keep it.
            // Clear the log text box.
            // Use the TypeScript cast to HTMLInputElement
            document.getElementById('taHostLog').value = '';
            // Set focus on the start button.
            // Use the TypeScript cast to HTMLInputElement
            document.getElementById('btnStartOS').focus();
            // Check for our testing and enrichment core, which
            // may be referenced here (from index.html) as function Glados().
            if (typeof Glados === 'function') {
                // function Glados() is here, so instantiate Her into
                // the global (and properly capitalized) _GLaDOS variable.
                _GLaDOS = new Glados();
                _GLaDOS.init();
            }
            // Start updating the taskbar clock every second
            setInterval(Control.updateTaskbarTime, 1000);
            Control.updateTaskbarTime();
        }
        static updateTaskbarTime() {
            const timetoday = document.getElementById('taskbar-time');
            if (timetoday) {
                const now = new Date();
                timetoday.textContent = now.toLocaleString();
            }
        }
        static hostLog(msg, source = '?') {
            // Note the OS CLOCK.
            var clock = _OSclock;
            // Note the REAL clock in milliseconds since January 1, 1970.
            var now = new Date().getTime();
            // Build the log string.
            var str = '({ clock:' +
                clock +
                ', source:' +
                source +
                ', msg:' +
                msg +
                ', now:' +
                now +
                ' })' +
                '\n';
            // Update the log console.
            var taLog = document.getElementById('taHostLog');
            taLog.value = str + taLog.value;
            // TODO in the future: Optionally update a log database or some streaming service.
        }
        //
        // Host Events
        //
        static hostBtnStartOS_click(btn) {
            // Disable the (passed-in) start button...
            btn.disabled = true;
            // .. enable the Halt and Reset buttons ...
            document.getElementById('btnHaltOS').disabled =
                false;
            document.getElementById('btnReset').disabled = false;
            // .. set focus on the OS console display ...
            document.getElementById('display').focus();
            // ... Create and initialize the CPU (because it's part of the hardware)  ...
            _CPU = new TSOS.Cpu(); // Note: We could simulate multi-core systems by instantiating more than one instance of the CPU here.
            _CPU.init(); //       There's more to do, like dealing with scheduling and such, but this would be a start. Pretty cool.
            _Memory = new TSOS.Memory();
            _Memory.init();
            _MemoryAccessor = new TSOS.MemoryAccessor();
            _MemoryManager = new TSOS.MemoryManager();
            // ... then set the host clock pulse ...
            _hardwareClockID = setInterval(TSOS.Devices.hostClockPulse, CPU_CLOCK_INTERVAL);
            // .. and call the OS Kernel Bootstrap routine.
            _Kernel = new TSOS.Kernel();
            _Kernel.krnBootstrap(); // _GLaDOS.afterStartup() will get called in there, if configured.
        }
        static hostBtnHaltOS_click(btn) {
            Control.hostLog('Emergency halt', 'host');
            Control.hostLog('Attempting Kernel shutdown.', 'host');
            // Call the OS shutdown routine.
            _Kernel.krnShutdown();
            // Stop the interval that's simulating our clock pulse.
            clearInterval(_hardwareClockID);
            // TODO: Is there anything else we need to do here?
        }
        static updateCPUDisplay() {
            const cpuElement = document.getElementById("cpuDisplay");
            if (!cpuElement || !_CPU)
                return;
            cpuElement.innerHTML =
                `PC: ${_CPU.PC.toString(16).padStart(4, '0').toUpperCase()}\n` +
                    `Acc: ${_CPU.Acc.toString(16).padStart(2, '0').toUpperCase()} (${_CPU.Acc})\n` +
                    `X: ${_CPU.Xreg.toString(16).padStart(2, '0').toUpperCase()}\n` +
                    `Y: ${_CPU.Yreg.toString(16).padStart(2, '0').toUpperCase()}\n` +
                    `Z: ${_CPU.Zflag}\n` +
                    `IR: ${_CPU.instructionReg || '??'}`;
        }
        static updatePCBDisplay() {
            const pcbElement = document.getElementById("pcbDisplay");
            if (!pcbElement || !_CurrentPCB)
                return;
            let swapInfo = "";
            if (_CurrentPCB.isOnDisk && _CurrentPCB.swapTSB) {
                const [t, s, b] = _CurrentPCB.swapTSB;
                swapInfo = `\nSwap: ${t},${s},${b}`;
            }
            pcbElement.innerHTML =
                `PID: ${_CurrentPCB.pid}\n` +
                    `State: ${_CurrentPCB.state}\n` +
                    `Location: ${_CurrentPCB.location ?? ""}\n` +
                    `Base: 0x${_CurrentPCB.base.toString(16).padStart(4, '0').toUpperCase()}\n` +
                    `Limit: 0x${_CurrentPCB.limit.toString(16).padStart(4, '0').toUpperCase()}\n` +
                    `PC: ${_CurrentPCB.pc}\n` +
                    `Acc: ${_CurrentPCB.acc}\n` +
                    `X: ${_CurrentPCB.xReg}\n` +
                    `Y: ${_CurrentPCB.yReg}\n` +
                    `Z: ${_CurrentPCB.zFlag}\n` +
                    `Wait: ${_CurrentPCB.waitTime}\n` +
                    `Turnaround: ${_CurrentPCB.turnaroundTime}` +
                    swapInfo;
        }
        static updateMemoryDisplay() {
            const memoryElement = document.getElementById("memoryDisplay");
            if (!memoryElement || !_Memory)
                return;
            const bytesToShow = 8;
            const rows = [];
            for (let addr = 0; addr < MEMORY_SIZE; addr += bytesToShow) {
                const rowValues = [];
                for (let offset = 0; offset < bytesToShow && addr + offset < MEMORY_SIZE; offset++) {
                    rowValues.push(_Memory.readDirect(addr + offset).toUpperCase());
                }
                rows.push(`0x${addr.toString(16).padStart(3, '0').toUpperCase()}: ${rowValues.join(' ')}`);
            }
            memoryElement.textContent = rows.join('\n');
        }
        static updateReadyQueueDisplay() {
            const queueElement = document.getElementById("readyQueueDisplay");
            if (!queueElement || !_ReadyQueue)
                return;
            let out = "";
            for (let i = 0; i < _ReadyQueue.getSize(); i++) {
                const pcb = _ReadyQueue.q[i];
                const segment = Math.floor(pcb.base / PARTITION_SIZE);
                let swapInfo = "";
                if (pcb.isOnDisk && pcb.swapTSB) {
                    const [t, s, b] = pcb.swapTSB;
                    swapInfo = `Swap: ${t},${s},${b}\n`;
                }
                out +=
                    `PID: ${pcb.pid}\n` +
                        `State: ${pcb.state}\n` +
                        `Location: ${pcb.location || "Memory"}\n` +
                        `Base: 0x${pcb.base.toString(16).padStart(4, '0')}\n` +
                        `Limit: 0x${pcb.limit.toString(16).padStart(4, '0')}\n` +
                        `Segment: ${pcb.segment}\n` +
                        `Priority: ${pcb.priority}\n` +
                        `Quantum: ${pcb.quantum}\n` +
                        `Wait: ${pcb.waitTime}\n` +
                        `Turnaround: ${pcb.turnaroundTime}\n` +
                        swapInfo +
                        `-------------------------\n`;
            }
            queueElement.textContent = out;
        }
        static hostBtnReset_click(btn) {
            // The easiest and most thorough way to do this is to reload (not refresh) the document.
            location.reload();
        }
    }
    TSOS.Control = Control;
})(TSOS || (TSOS = {}));
// Hall of Fame Projects: LongOS and AquaOS
// Used AI to help synchronize/adapt PCB display to ready queue display
//# sourceMappingURL=control.js.map