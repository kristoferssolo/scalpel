import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface ScalpelE2EApp {
  app: ElectronApplication
  window: Page
  userDataDir: string
  cleanup: () => Promise<void>
}

export interface ScalpelE2EOptions {
  /** Pre-seeded electron-store config values written to config.json before launch. */
  seedConfig?: Record<string, unknown>
}

const CONFIG_FILE = 'config.json'

export async function launchScalpelE2E(opts?: ScalpelE2EOptions): Promise<ScalpelE2EApp> {
  const userDataDir = await mkdtemp(join(tmpdir(), 'scalpel-e2e-'))
  try {
    if (opts?.seedConfig) {
      await writeFile(join(userDataDir, CONFIG_FILE), JSON.stringify(opts.seedConfig), 'utf8')
    }
    const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...env } = process.env
    const app = await electron.launch({
      args: [join(process.cwd(), 'out/main/index.js'), '--ozone-platform=x11'],
      env: {
        ...env,
        NODE_ENV: 'test',
        SCALPEL_E2E: '1',
        SCALPEL_E2E_USER_DATA: userDataDir,
      },
    })
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    return {
      app,
      window,
      userDataDir,
      cleanup: async () => {
        await app.close().catch(() => undefined)
        await rm(userDataDir, { recursive: true, force: true })
      },
    }
  } catch (err) {
    // Launch failed before we could hand back a cleanup fn - don't leak the temp dir.
    await rm(userDataDir, { recursive: true, force: true })
    throw err
  }
}
