/* ------------
     Console.ts

     The OS Console - stdIn and stdOut by default.
     Note: This is not the Shell. The Shell is the "command line interface" (CLI) or interpreter for this console.
     ------------ */
var TSOS;
(function (TSOS) {
    class Console {
        currentFont;
        currentFontSize;
        currentXPosition;
        currentYPosition;
        buffer;
        constructor(currentFont = _DefaultFontFamily, currentFontSize = _DefaultFontSize, currentXPosition = 0, currentYPosition = _DefaultFontSize, buffer = "") {
            this.currentFont = currentFont;
            this.currentFontSize = currentFontSize;
            this.currentXPosition = currentXPosition;
            this.currentYPosition = currentYPosition;
            this.buffer = buffer;
        }
        init() {
            this.clearScreen();
            this.resetXY();
        }
        clearScreen() {
            _DrawingContext.clearRect(0, 0, _Canvas.width, _Canvas.height);
        }
        resetXY() {
            this.currentXPosition = 0;
            this.currentYPosition = this.currentFontSize;
        }
        handleInput() {
            while (_KernelInputQueue.getSize() > 0) {
                // Get the next character from the kernel input queue.
                var chr = _KernelInputQueue.dequeue();
                // Check to see if it's "special" (enter or ctrl-c) or "normal" (anything else that the keyboard device driver gave us).
                if (chr === String.fromCharCode(13)) { // the Enter key
                    // The enter key marks the end of a console command, so ...
                    // ... tell the shell ...
                    _OsShell.handleInput(this.buffer);
                    if (this.buffer.trim() !== "") {
                        this.history.push(this.buffer);
                        this.historyIndex = this.history.length; // reset to end
                    }
                    this.buffer = "";
                }
                else if (chr === String.fromCharCode(8)) { // backspace
                    this.handleBackspace();
                }
                else if (chr === String.fromCharCode(9)) { // tab
                    this.handleTabCompletion();
                }
                else if (chr === "up") { // up arrow
                    this.handleHistory("up");
                }
                else if (chr === "down") { // down arrow
                    this.handleHistory("down");
                }
                else {
                    // This is a "normal" character, so ...
                    // ... draw it on the screen...
                    this.putText(chr);
                    // ... and add it to our buffer.
                    this.buffer += chr;
                }
                // TODO: Add a case for Ctrl-C that would allow the user to break the current program.
            }
        }
        handleBackspace() {
            if (this.buffer.length > 0) {
                this.buffer = this.buffer.slice(0, -1);
                // Measure char width
                const lChar = this.buffer.charAt(this.buffer.length - 1);
                const offset = _DrawingContext.measureText(this.currentFont, this.currentFontSize, lChar);
                const padding = offset + 2;
                // Move cursor back and clear that char
                this.currentXPosition -= offset;
                _DrawingContext.clearRect(this.currentXPosition, this.currentYPosition - this.currentFontSize, padding, this.currentFontSize + _FontHeightMargin);
            }
        }
        history = [];
        historyIndex = -1;
        handleHistory(direction) {
            if (this.history.length === 0) {
                return; // nothing to recall
            }
            if (direction === "up") {
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                }
            }
            else if (direction === "down") {
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                }
                else {
                    this.historyIndex = this.history.length;
                    this.diffBuffer("");
                    return;
                }
                if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
                    this.diffBuffer(this.history[this.historyIndex]);
                }
            }
        }
        diffBuffer(newBuffer) {
            this.clearLine();
            this.buffer = newBuffer;
            this.putText(this.buffer);
        }
        clearLine() {
            this.currentXPosition = 0;
            _DrawingContext.clearRect(0, this.currentYPosition - this.currentFontSize, _Canvas.width, this.currentFontSize + _FontHeightMargin);
        }
        handleTabCompletion() {
            if (this.buffer.length === 0)
                return;
            const fetches = _OsShell.commandList
                .map(cmd => cmd.command)
                .filter(cmd => cmd.startsWith(this.buffer));
            if (fetches.length === 1) {
                // Autocomplete to the full command
                const completion = fetches[0].slice(this.buffer.length);
                this.putText(completion);
                this.buffer += completion;
            }
            else if (fetches.length > 1) {
                // Show all possible matches
                this.advanceLine();
                _StdOut.putText(fetches.join("    "));
                this.advanceLine();
                _StdOut.putText(this.buffer); // reprint current buffer
            }
        }
        putText(text) {
            /*  My first inclination here was to write two functions: putChar() and putString().
                Then I remembered that JavaScript is (sadly) untyped and it won't differentiate
                between the two. (Although TypeScript would. But we're compiling to JavaScipt anyway.)
                So rather than be like PHP and write two (or more) functions that
                do the same thing, thereby encouraging confusion and decreasing readability, I
                decided to write one function and use the term "text" to connote string or char.
            */
            if (text !== "") {
                for (let i = 0; i < text.length; i++) {
                    const char = text[i];
                    const offset = _DrawingContext.measureText(this.currentFont, this.currentFontSize, char);
                    // Check if the character would exceed the canvas width
                    if (this.currentXPosition + offset > _Canvas.width) {
                        this.advanceLine();
                        this.currentXPosition = 0;
                    }
                    // Draw the character at the current position
                    _DrawingContext.drawText(this.currentFont, this.currentFontSize, this.currentXPosition, this.currentYPosition, char);
                    // Move the current X position
                    this.currentXPosition += offset;
                }
            }
        }
        advanceLine() {
            this.currentXPosition = 0;
            /*
             * Font size measures from the baseline to the highest point in the font.
             * Font descent measures from the baseline to the lowest point in the font.
             * Font height margin is extra spacing between the lines.
             */
            this.currentYPosition += _DefaultFontSize +
                _DrawingContext.fontDescent(this.currentFont, this.currentFontSize) +
                _FontHeightMargin;
            // Handle scrolling
            if (this.currentYPosition > _Canvas.height) {
                const LHeight = _DefaultFontSize +
                    _DrawingContext.fontDescent(this.currentFont, this.currentFontSize) +
                    _FontHeightMargin;
                const skipY = LHeight; // skip top line
                const RHeight = _Canvas.height - LHeight; // keep everything else
                // Copy everything except the top line
                const canvasData = _DrawingContext.getImageData(0, skipY, _Canvas.width, RHeight);
                // Clear screen
                this.clearScreen();
                // Redraw shifted up
                _DrawingContext.putImageData(canvasData, 0, 0);
                // Clear the bottom line area so it's blank for new text
                _DrawingContext.clearRect(0, RHeight, _Canvas.width, LHeight);
                // Move cursor to bottom line baseline
                this.currentYPosition = _Canvas.height - LHeight + _DefaultFontSize;
            }
            // Sources:
            // https://stackoverflow.com/questions/702585/simulating-a-tab-keypress-using-javascript
            // https://stackoverflow.com/questions/6637341/use-tab-to-indent-in-textarea
            // https://stackoverflow.com/questions/29584942/implementing-history-in-own-shell-c
            // https://stackoverflow.com/questions/13207678/whats-the-simplest-way-of-detecting-keyboard-input-in-a-script-from-the-termina
            // https://stackoverflow.com/questions/28180574/html5-canvas-and-scrolling
            // https://stackoverflow.com/questions/15369111/creating-scrollable-output-in-command-line-programs
            // https://stackoverflow.com/questions/1837555/ajax-autocomplete-or-autosuggest-with-tab-completion-autofill-similar-to-shell
            // https://stackoverflow.com/questions/25928762/js-text-input-history-on-up-arrow
            // https://www.jqueryscript.net/form/up-down-arrow-history-recall.html
            // https://stackoverflow.com/questions/18647252/how-to-detect-special-characters-in-keydown-event
            // Many youtube videos related to general typescript coding
            // Used AI for some code optimization suggestions
            // Friend who is graduate student gave ideas/refinment
            // Hall of Fame Project LizzOS
        }
    }
    TSOS.Console = Console;
})(TSOS || (TSOS = {}));
//# sourceMappingURL=console.js.map