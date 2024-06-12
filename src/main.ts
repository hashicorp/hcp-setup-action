import { setFailed } from '@actions/core'

if (require.main === module) {
  run()
}

export async function run(): Promise<void> {
  try {
    await realRun()
  } catch (err) {
    setFailed(`hashicorp/hcp-setup-action failed: ${err.message}`)
  }
}

async function realRun(): Promise<void> {
}
