# CA Offline Suite - Development & Update Process Guide

**Subject: Important: CA Offline Suite Development & Update Process - Please Read Carefully**

Dear Team,

This email outlines the complete development, testing, and release process for the CA Offline Suite application. Please follow these procedures carefully to ensure smooth updates and avoid any issues with client deployments.

## 🚨 Important Repository Information

We maintain **TWO separate repositories** for different purposes:

1. **Developer Repository** (For Testing): https://github.com/Shama-Cyphersol/ca-offline-suite.git
   - Used for development and internal testing
   - Releases here trigger update notifications ONLY on our development machines
   - Use this for all development work and testing

2. **Production Repository** (Client-Facing): https://github.com/Shama-Cyphersol/beta_testers_ca.git
   - Connected to actual client installations
   - Releases here trigger updates for ALL clients
   - Only push here after thorough testing in the developer repository

## 📋 Development Workflow

### 1. Branch Management
- **Always create a new branch** for each feature/fix
- Branch naming convention: `[type]/[scope]-[description]`
  - Examples: 
    - `feature/backend-tax-calculation`
    - `fix/frontend-ui-alignment`
    - `update/backend-api-optimization`
- Create corresponding GitHub issues for tracking
- Follow proper GitHub flow (branch → develop → test → merge)

### 2. Local Development Setup

#### Backend Development:
1. Navigate to the `backend` folder
2. Run FastAPI backend: `python main.py` or `uvicorn main:app --reload`
3. Test all backend logic thoroughly
4. Verify API endpoints are working correctly

#### Frontend Development:
1. Navigate to `frontend` folder
2. Start Electron: `npm start`
3. Navigate to `frontend/react-app`
4. Start React app: `npm start`
5. Test all UI changes and functionality

### 3. Building for Testing

Once local testing is complete:

1. **Build Backend Executable:**
   ```bash
   # From root directory
   pyinstaller --onedir backend/main.py
   ```

2. **Post-Build Processing:**
   ```bash
   # From root directory
   python postbuild.py
   ```
   This transfers Excel/CSV files and models to the build directory

3. **Build Frontend:**
   ```bash
   # From frontend directory
   cd frontend
   npm run build
   ```
   The installer will be generated in `frontend/dist` folder

### 4. Version Management

**⚠️ CRITICAL: Update version in THREE places:**

1. **package.json** (frontend/package.json):
   ```json
   "version": "1.0.15"
   ```

2. **splash.html** (frontend/react-app/splash.html):
   ```html
   <div class="version-badge">Version 1.0.15</div>
   ```

3. **main.js logging statements** - The app uses `app.getVersion()` which reads from package.json, but verify logging is working correctly

### 5. Testing Process

#### Local Build Testing:
1. Install the generated installer from `frontend/dist`
2. Verify all new features work in the installed version
3. Check that existing features are not broken
4. Test update mechanism (if applicable)

#### Update Testing:
1. **Developer Repository Testing:**
   ```bash
   # From frontend directory
   npm run release
   ```
   This pushes to GitHub releases in the developer repository

2. **Verify Update Notification:**
   - Existing installations should receive update notification
   - Install the update and verify it works correctly
   - Check that all changes are reflected in the updated version

3. **Production Release** (Only after thorough testing):
   - Switch to production repository
   - Apply the same changes
   - Run `npm run release` to trigger client updates

## 📝 Pre-Release Checklist

Before any release, ensure:

- [ ] All features tested locally
- [ ] Backend logic verified with FastAPI
- [ ] Frontend UI/UX tested thoroughly
- [ ] Version bumped in all THREE locations
- [ ] Build created and tested locally
- [ ] Update tested in developer repository
- [ ] All tests pass
- [ ] Code reviewed by at least one team member
- [ ] Documentation updated if needed

## 🔧 Common Commands Reference

```bash
# Backend
cd backend
python main.py                          # Run backend locally
pyinstaller --onedir backend/main.py    # Build backend executable

# Post-build
python postbuild.py                     # Transfer assets to build

# Frontend
cd frontend
npm start                               # Start Electron app
npm run build                          # Create installer
npm run release                        # Push to GitHub releases

# React App
cd frontend/react-app
npm start                              # Start React development server
```

## ⚠️ Important Notes

1. **Never push directly to the production repository** without testing in the developer repository first
2. **Always create backups** before major updates
3. **Document any breaking changes** in release notes
4. **Test on multiple machines** if possible
5. **Monitor GitHub issues** for any reported problems

## 🆘 Troubleshooting

If you encounter issues:
1. Check the build logs in the root directory
2. Verify all dependencies are installed
3. Ensure version numbers are consistent across all files
4. Check GitHub Actions for any CI/CD failures

## 📞 Questions?

If you have any questions about this process or encounter any issues, please:
1. Check existing GitHub issues
2. Create a new issue with detailed information
3. Reach out to the team lead

Remember: **Quality over speed**. It's better to take extra time testing than to push a broken update to clients.

Best regards,
[Your Name]
Development Team Lead 