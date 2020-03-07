import mockFS from 'mock-fs'

import {
    diffDependenciesLists,
    discoverSourceFiles,
    extractDeclaredDependencies,
    getImportsFromFile,
    getImportsFromFiles,
} from './useCases'
import { es6Source, requireSource } from './testConstants'

const nonSourceFiles = {
    'node_modules/@babel/yeet': 'dang',
    'README.md': 'yeet',
}

const sourceFiles = {
    './yeet.js': es6Source,
    './yeets/yoot.ts': requireSource,
}

const mockFileSystem = {
    ...nonSourceFiles,
    ...sourceFiles,
}

describe('Use cases', () => {
    beforeEach(() => {
        jest.restoreAllMocks()
        mockFS(mockFileSystem)
    })

    afterEach(() => {
        mockFS.restore()
    })

    describe('Extracting imports from single files', () => {
        it('Using ES6 imports', () => {
            const extracted = getImportsFromFile('yeet.js')

            expect(new Set(extracted)).toEqual(
                new Set(['yeets', '@yeets/sticks']),
            )
        })

        it('Using require imports', () => {
            const extracted = getImportsFromFile('yeets/yoot.ts')

            expect(new Set(extracted)).toEqual(
                new Set(['yeets', '@yeets/sticks']),
            )
        })
    })

    describe('Extracting imports from multiple files', () => {
        it('With multiple files', () => {
            const paths = ['yeet.js', 'yeets/yoot.ts']

            const extracted = getImportsFromFiles(paths)

            expect(new Set(extracted)).toEqual(
                new Set(['yeets', '@yeets/sticks']),
            )
        })
    })

    describe('Dependencies list diffing', () => {
        beforeEach(mockFS.restore)
        it('correctly diffs', () => {
            const left = ['yeet', 'dang', 'sticks']
            const right = ['yeet', 'yeetas']

            const diffReport = diffDependenciesLists(left, right)
            expect(diffReport.left).toEqual(['dang', 'sticks'])
            expect(diffReport.right).toEqual(['yeetas'])
            expect(diffReport.union).toEqual(['yeet'])
        })

        it('filters if a filter is provided', () => {
            const left = ['yeet', 'dang', 'sticks']
            const right = ['yeet', 'yeetas']
            const filter = (name: string): boolean => !name.includes('yeet')

            const diffReport = diffDependenciesLists(left, right, filter)

            expect(diffReport.left).toEqual(['dang', 'sticks'])
            expect(diffReport.right).toEqual([])
            expect(diffReport.union).toEqual([])
        })

        it('filters out partial matches in either set', () => {
            const left = ['yeet', 'yoot/get']
            const right = ['yoot', 'yeet/put']

            const diffReport = diffDependenciesLists(left, right)

            expect(diffReport.left).toEqual(['yeet'])
            expect(diffReport.right).toEqual(['yoot'])
            expect(diffReport.union).toEqual([])
        })
    })

    describe('Source file discovery', () => {
        it('finds source files', () => {
            const discoveredFiles = discoverSourceFiles('.')
            expect(discoveredFiles).toEqual(Object.keys(sourceFiles))
        })

        it('finds source files with file as path', () => {
            const discoveredFiles = discoverSourceFiles('yeet.js')
            expect(discoveredFiles).toEqual(['yeet.js'])
        })
    })

    describe('Extract declared dependencies list from package', () => {
        beforeEach(() => {
            mockFS.restore()
        })
        it('works with default path', () => {
            const mockPackageJSON = {
                dependencies: {
                    yeet: '^1.0.0',
                    sticks: '^2.0.0',
                    '@babel/yeet': '^9.9.9',
                },
            }
            mockFS({
                'package.json': JSON.stringify(mockPackageJSON),
            })

            const extracted = extractDeclaredDependencies()

            expect(extracted).toEqual({
                dependencies: Object.keys(mockPackageJSON.dependencies),
                peerDependencies: [],
            })
        })

        it('uses defaults if there are no dependencies or peer dependencies', () => {
            mockFS({
                'package.json': '{}',
            })

            const extracted = extractDeclaredDependencies('.')
            expect(extracted).toEqual({
                dependencies: [],
                peerDependencies: [],
            })
        })

        it('works', () => {
            const mockPackageJSON = {
                dependencies: {
                    yeet: '^1.0.0',
                    sticks: '^2.0.0',
                    '@babel/yeet': '^9.9.9',
                },
            }
            mockFS({
                'package.json': JSON.stringify(mockPackageJSON),
            })

            const extracted = extractDeclaredDependencies('.')

            expect(extracted).toEqual({
                dependencies: Object.keys(mockPackageJSON.dependencies),
                peerDependencies: [],
            })
        })

        it('errors', () => {
            mockFS({})

            const extracted = extractDeclaredDependencies('.')

            expect(extracted).toEqual({
                dependencies: [],
                peerDependencies: [],
            })
        })
    })
})
