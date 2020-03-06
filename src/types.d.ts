declare module 'mock-fs'

interface JSONObject {
    [property: string]: string | boolean | number | JSONObject
}

export interface PackageConfig {
    dependencies: JSONObject
    devDependencies: JSONObject
    peerDependencies: JSONObject
    [property: string]: string | JSONObject
}

export interface PackageDependencies {
    dependencies?: string[]
    devDependencies?: string[]
    peerDependencies?: string[]
}

export interface DiffReport {
    left: string[]
    right: string[]
    union: string[]
}
