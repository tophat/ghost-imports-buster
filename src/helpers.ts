import { SOURCE_FILE_PATTERN } from './constants'

export function isValidSourceFile(path: string): boolean {
    const pattern = SOURCE_FILE_PATTERN
    return pattern.test(path)
}
