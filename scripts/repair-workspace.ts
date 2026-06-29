/**
 * Repairs workspaces missing after registration bug.
 * Run: bun run scripts/repair-workspace.ts
 */
import { getBootstrapState, createWorkspaceForOwner, findUserById } from "../lib/store"

async function main() {
  const state = await getBootstrapState()

  if (state.hasWorkspace) {
    console.log("Workspace already exists — nothing to repair.")
    return
  }

  if (!state.hasUsers) {
    console.log("No users found — nothing to repair.")
    return
  }

  const owner = state.owner
  if (!owner) {
    console.error("Owner user not found.")
    process.exit(1)
  }

  const user = await findUserById(owner.id)
  if (!user) {
    console.error("Owner user not found.")
    process.exit(1)
  }

  const workspace = await createWorkspaceForOwner(user)
  console.log(`Created workspace "${workspace.name}" (${workspace.id}) for ${user.email}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
