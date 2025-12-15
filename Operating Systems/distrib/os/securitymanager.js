var TSOS;
(function (TSOS) {
    class SecurityManager {
        users = new Map();
        currentUser = null;
        constructor() {
            this.loadUsers();
        }
        /* AUTH */
        login(username, password) {
            const user = this.users.get(username);
            if (!user)
                return false;
            const hash = this.hash(password);
            if (hash !== user.passwordHash) {
                this.log(`FAILED LOGIN for ${username}`);
                return false;
            }
            this.currentUser = username;
            this.log(`LOGIN ${username}`);
            return true;
        }
        logout() {
            if (this.currentUser) {
                this.log(`LOGOUT ${this.currentUser}`);
            }
            this.currentUser = null;
        }
        getCurrentUser() {
            return this.currentUser;
        }
        addUser(username, password) {
            if (this.users.has(username))
                return false;
            this.users.set(username, {
                username,
                passwordHash: this.hash(password)
            });
            this.saveUsers();
            this.log(`USER CREATED ${username}`);
            return true;
        }
        /* STORAGE  */
        saveUsers() {
            const data = JSON.stringify([...this.users.values()]);
            sessionStorage.setItem("users", data);
        }
        loadUsers() {
            const raw = sessionStorage.getItem("users");
            if (!raw) {
                // create "admin" account-
                this.addUser("king", "fitsum");
                return;
            }
            const parsed = JSON.parse(raw);
            for (const u of parsed) {
                this.users.set(u.username, u);
            }
        }
        /* LOGGING */
        log(event) {
            const time = new Date().toISOString();
            const line = `[${time}] ${event}\n`;
            const prev = sessionStorage.getItem("auditlog") ?? "";
            sessionStorage.setItem("auditlog", prev + line);
        }
        /* HASH  */
        hash(input) {
            let h = 0;
            for (let i = 0; i < input.length; i++) {
                h = (h << 5) - h + input.charCodeAt(i);
                h |= 0;
            }
            return h.toString(16);
        }
    }
    TSOS.SecurityManager = SecurityManager;
})(TSOS || (TSOS = {}));
//# sourceMappingURL=securitymanager.js.map