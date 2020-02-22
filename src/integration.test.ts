import { execSync } from 'child_process'
import { join as joinPath } from 'path'

describe('Integration scenarios', () => {
    beforeEach(() => {
        execSync('yarn build', { stdio: 'pipe', cwd: joinPath(__dirname, '..') } )
    })

    it('works', () => {
        
    })
})
