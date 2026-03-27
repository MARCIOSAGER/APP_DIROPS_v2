Build and deploy DIROPS-SGA to production (Hostinger).

Steps:
1. Run `npx vite build` and verify exit code 0
2. Run `scp -P 65002 -r -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no dist/* u617589611@62.72.62.61:domains/app.marciosager.com/public_html/`
3. Report success with the build size and deploy status
4. If build fails, show the error and do NOT deploy
