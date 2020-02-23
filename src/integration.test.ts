import { execSync } from 'child_process'
import { join as joinPath } from 'path'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'

function setUpIntegrationProject(
    mockPackageFile: object,
    mockSource: object,
): string {
    const projectRoot = mkdtempSync('integration_temp')
    const sourcePath = joinPath(projectRoot, 'src')
    mkdirSync(sourcePath)

    writeFileSync(
        joinPath(projectRoot, 'package.json'),
        JSON.stringify(mockPackageFile),
    )

    Object.entries(mockSource).forEach(([fn, content]: string[]) => {
        writeFileSync(joinPath(sourcePath, fn), content)
    })

    return projectRoot
}

function cleanUpIntegrationProject(): void {
    execSync('rimraf integration_temp*', { cwd: joinPath(__dirname, '..') })
}

describe('Integration scenarios', () => {
    const libPath = joinPath('.', 'lib', 'index.js')
    let projectPath: string

    beforeEach(() => {
        execSync('yarn build', {
            stdio: 'pipe',
            cwd: joinPath(__dirname, '..'),
        })
    })

    afterEach(() => {
        cleanUpIntegrationProject()
    })

    function run(): string {
        const out = execSync(
            `FORCE_COLOR=0 node ${libPath} validate ${projectPath}`,
            {
                encoding: 'utf-8',
                stdio: 'pipe',
                cwd: joinPath(__dirname, '..'),
            },
        )
        return out.replace(new RegExp(projectPath, 'g'), '[project_root]')
    }

    it('No unused dependencies, no undeclared dependencies', () => {
        const mockPackageFile = {
            dependencies: {
                yeet: '^1.0.0',
            },
        }

        const mockSource = {
            'index.js': `
            import { dang } from 'yeet'

            console.log('woop woop')
            `,
        }

        projectPath = setUpIntegrationProject(mockPackageFile, mockSource)

        const output = run()
        expect(output).toContain('No unused dependencies!')
        expect(output).toContain('No undeclared dependencies!')
    })

    it('Unused dependencies, no undeclared dependencies', () => {
        const mockPackageFile = {
            dependencies: {
                yeet: '^1.0.0',
                yeetsticks: '^1.2.1',
                nope: '10.1.0',
            },
        }

        const mockSource = {
            'index.js': `
            import { dang } from 'yeet'

            console.log('woop woop')
            `,
        }

        projectPath = setUpIntegrationProject(mockPackageFile, mockSource)

        const output = run()
        expect(output).toContain(
            'The following dependencies are declared in [project_root]/package.json but are not imported anywhere:',
        )
        expect(output).toContain('yeetsticks')
        expect(output).toContain('nope')
        expect(output).toContain('No undeclared dependencies!')
    })

    it('No unused dependencies, Undeclared dependencies', () => {
        const mockPackageFile = {
            dependencies: {
                yeet: '^1.0.0',
            },
        }

        const mockSource = {
            'index.js': `
            import { dang } from 'yeet'
            import { womp } from 'yeetsticks'

            console.log('woop woop')
            `,
        }

        projectPath = setUpIntegrationProject(mockPackageFile, mockSource)

        const output = run()

        expect(output).toContain('No unused dependencies!')
        expect(output).toContain(
            'The following dependencies are imported but not declared in [project_root]:\nyeetsticks',
        )
    })
    it('Unused dependencies, Undeclared dependencies', () => {
        const mockPackageFile = {
            dependencies: {
                yeet: '^1.0.0',
                yeetsticks: '^1.2.3',
            },
        }

        const mockSource = {
            'index.js': `
            import { dang } from 'yeet'
            import { woop } from 'doop'

            console.log('woop woop')
            `,
        }

        projectPath = setUpIntegrationProject(mockPackageFile, mockSource)

        const output = run()
        expect(output).toContain(
            'The following dependencies are declared in [project_root]/package.json but are not imported anywhere:\nyeetsticks',
        )
        expect(output).toContain(
            'The following dependencies are imported but not declared in [project_root]:\ndoop',
        )
    })
})
