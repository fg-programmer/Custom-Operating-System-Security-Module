/* ----------------------------------
   DeviceDriverKeyboard.ts

   The Kernel Keyboard Device Driver.
   ---------------------------------- */

module TSOS {
  // Extends DeviceDriver
  export class DeviceDriverKeyboard extends DeviceDriver {
    constructor() {
      // Override the base method pointers.

      // The code below cannot run because "this" can only be
      // accessed after calling super.
      // super(this.krnKbdDriverEntry, this.krnKbdDispatchKeyPress);
      // So instead...
      super();
      this.driverEntry = this.krnKbdDriverEntry;
      this.isr = this.krnKbdDispatchKeyPress;
    }

    public krnKbdDriverEntry() {
      // Initialization routine for this, the kernel-mode Keyboard Device Driver.
      this.status = 'loaded';
      // More?
    }

    public krnKbdDispatchKeyPress(params) {
      // Parse the params.  TODO: Check that the params are valid and osTrapError if not.
      var keyCode = params[0];
      var isShifted = params[1];
      _Kernel.krnTrace('Key code:' + keyCode + ' shifted:' + isShifted);
      var chr = '';
      // Check to see if we even want to deal with the key that was pressed.
      if (keyCode >= 65 && keyCode <= 90) {
        // letter
        if (isShifted === true) {
          chr = String.fromCharCode(keyCode); // Uppercase A-Z
        } else {
          chr = String.fromCharCode(keyCode + 32); // Lowercase a-z
        }
        // TODO: Check for caps-lock and handle as shifted if so.
        _KernelInputQueue.enqueue(chr);
      } else if (
        (keyCode >= 48 && keyCode <= 57) || // digits
        keyCode == 32 || // space
        keyCode == 13
      ) {
        // enter
        chr = String.fromCharCode(keyCode);
        _KernelInputQueue.enqueue(chr);
      } else if (keyCode >= 186 && keyCode <= 222) {
        const punctuation = {
          186: isShifted ? ':' : ';',
          187: isShifted ? '+' : '=',
          188: isShifted ? '<' : ',',
          189: isShifted ? '_' : '-',
          190: isShifted ? '>' : '.',
          191: isShifted ? '?' : '/',
          192: isShifted ? '~' : '`',
          219: isShifted ? '{' : '[',
          220: isShifted ? '|' : '\\',
          221: isShifted ? '}' : ']',
          222: isShifted ? '"' : "'",
        };
        const chr = punctuation[keyCode];
        _KernelInputQueue.enqueue(chr);
      }
          else {
        switch (keyCode) {
            case 8:  // Backspace
                _KernelInputQueue.enqueue(String.fromCharCode(8));
                break;
            case 9:  // Tab
                _KernelInputQueue.enqueue(String.fromCharCode(9));
                break;
            case 38: // Up arrow
                _KernelInputQueue.enqueue("up");
                break;
            case 40: // Down arrow
                _KernelInputQueue.enqueue("down");
                break;
            default:
                _KernelInputQueue.enqueue(chr); 
        }
      }
    }
  }
}
