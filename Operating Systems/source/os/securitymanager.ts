module TSOS {

    export interface User {
        username: string;
        passwordHash: string;
    }

    export class SecurityManager {
        private users: Map<string, User> = new Map();
        private currentUser: string | null = null;

        constructor() {
            this.loadUsers();
        }

        /* AUTH */

        public login(username: string, password: string): boolean {
            const user = this.users.get(username);
            if (!user) return false;

            const hash = this.hash(password);
            if (hash !== user.passwordHash) {
                this.log(`FAILED LOGIN for ${username}`);
                return false;
            }

            this.currentUser = username;
            this.log(`LOGIN ${username}`);
            return true;
        }

        public logout(): void {
            if (this.currentUser) {
                this.log(`LOGOUT ${this.currentUser}`);
            }
            this.currentUser = null;
        }

        public getCurrentUser(): string | null {
            return this.currentUser;
        }

        public addUser(username: string, password: string): boolean {
            if (this.users.has(username)) return false;
            this.users.set(username, {
                username,
                passwordHash: this.hash(password)
            });
            this.saveUsers();
            this.log(`USER CREATED ${username}`);
            return true;
        }

        /* STORAGE  */

        private saveUsers(): void {
            const data = JSON.stringify([...this.users.values()]);
            sessionStorage.setItem("users", data);
        }

        private loadUsers(): void {
            const raw = sessionStorage.getItem("users");
            if (!raw) {
                // create "admin" account-
                this.addUser("king", "fitsum");
                return;
            }
            const parsed: User[] = JSON.parse(raw);
            for (const u of parsed) {
                this.users.set(u.username, u);
            }
        }

        /* LOGGING */

        public log(event: string): void {
            const time = new Date().toISOString();
            const line = `[${time}] ${event}\n`;
            const prev = sessionStorage.getItem("auditlog") ?? "";
            sessionStorage.setItem("auditlog", prev + line);
        }

        /* HASH  */

        private hash(input: string): string {
            let h = 0;
            for (let i = 0; i < input.length; i++) {
                h = (h << 5) - h + input.charCodeAt(i);
                h |= 0;
            }
            return h.toString(16);
        }
    }
}
