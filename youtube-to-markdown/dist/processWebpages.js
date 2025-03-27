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
const webScraper_1 = require("./scrapers/webScraper");
const webpageList_1 = require("./webpageList");
const schema_1 = require("./database/schema");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting webpage processing...');
        // Initialize the database
        yield (0, schema_1.initDb)();
        // Process all webpages
        yield (0, webScraper_1.processWebpages)(webpageList_1.webpagesToProcess);
        // Close the database connection
        yield (0, schema_1.closeDb)();
        console.log('Webpage processing completed!');
    });
}
// Run the main function
main().catch(error => {
    console.error('Unhandled error during webpage processing:', error);
    process.exit(1);
});
