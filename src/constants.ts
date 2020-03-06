export const ES6_IMPORT_STATEMENT = /import [{}\w\s,]+ from ['"]([\w@/]+)['"]/g
export const REQUIRE_IMPORT_STATEMENT = /(?:const|var|let) [ {}\w]+ = require\(['"]([\w@/]+)['"]\)/g
export const SOURCE_FILE_PATTERN = /[\w.\- ]+(?<![jt]est)\.[tj]sx?$/
