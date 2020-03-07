import { SOURCE_FILE_PATTERN } from './constants'

export function isValidSourceFile(path: string): boolean {
    const pattern = SOURCE_FILE_PATTERN
    return pattern.test(path)
}

export function isPartialMatch(left: string, right: string): boolean {
    const prefixPattern = new RegExp(`^${left}/`)
    return prefixPattern.test(right)
}

/*
export function isBuiltIn(packageName: string): boolean {
    try {
        return !require.resolve(packageName).includes('node_modules')
    } catch (e) {
        console.log(e)
        return false
    }
}*/
