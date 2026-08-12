const fs = require('fs');

function replaceListeners(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    let counter = 0;
    
    if (filePath.includes('anti-cheat.js')) {
        code = code.replace(/document\.addEventListener\('([^']+)',\s*function\s*\(([^)]*)\)\s*\{/g, (match, evt, args) => {
            counter++;
            return `const ${evt.replace(/[^a-zA-Z]/g, '')}Handler_${counter} = function(${args}) {
        if (typeof eventManager !== 'undefined') {
            eventManager.on(document, '${evt}', ${evt.replace(/[^a-zA-Z]/g, '')}Handler_${counter});
        } else {
            document.addEventListener('${evt}', ${evt.replace(/[^a-zA-Z]/g, '')}Handler_${counter});
        }
        
        // --- Original function body below ---
        `;
        });
        
        // Wait, I can't just inject that at the start, because the closing `});` needs to be matched.
        // Doing this safely with regex is hard.
    }
}
// Aborting regex replacement. It's easier to manually replace the few lines in anti-cheat.js.
