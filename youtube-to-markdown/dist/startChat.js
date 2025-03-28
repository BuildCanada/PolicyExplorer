"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const policyChat_1 = require("./chat/policyChat");
const schema_1 = require("./database/schema");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Initializing database...');
        yield (0, schema_1.initDb)();
        console.log('Starting policy chat interface...');
        yield (0, policyChat_1.startPolicyChat)();
    });
}
main().catch(error => {
    console.error('Error starting application:', error);
    process.exit(1);
});
