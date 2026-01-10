
const content = `const MASTER_CATALOG = {
  "Ace Trek": [
    "Beige",
    "Black",
    "Brown"
  ],
  "Amka": [
    "Black",
    "White"
  ]
};`;

function parseJavaScriptJSON(content) {
    try {
      // Remove comments (both single line and multi-line)
      content = content.replace(/\/\/.*$/gm, ''); // Remove single line comments
      content = content.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

      // Remove variable declaration and trailing semicolon
      content = content.trim();

      // Remove any variable assignment (const, let, var) with any variable name
      const regex = /^(?:const|let|var)\s+\w+\s*=\s*/;
      if (regex.test(content)) {
        content = content.replace(regex, '');
      }

      // Remove trailing semicolon
      if (content.endsWith(';')) {
        content = content.substring(0, content.length - 1);
      }

      // Remove any extra whitespace
      content = content.trim();

      return JSON.parse(content);
    } catch (error) {
      throw new Error("Invalid JavaScript JSON format: " + error.message);
    }
}

try {
    const result = parseJavaScriptJSON(content);
    console.log("Success:", JSON.stringify(result, null, 2));

    if (Array.isArray(result)) {
        console.log("Is Array");
    } else {
        console.log("Is Object");
    }
} catch (e) {
    console.error(e.message);
}
