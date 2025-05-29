const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  console.log('Running beforePack hook...');
  
  // Path to the NSIS installSection template
  const installSectionPath = path.join(
    __dirname,
    '../node_modules/app-builder-lib/templates/nsis/installSection.nsh'
  );
  
  // Check if the file exists
  if (fs.existsSync(installSectionPath)) {
    // Read the file
    let content = fs.readFileSync(installSectionPath, 'utf8');
    
    // Replace SetDetailsPrint none with SetDetailsPrint both
    if (content.includes('SetDetailsPrint none')) {
      content = content.replace(/SetDetailsPrint none/g, 'SetDetailsPrint both');
      
      // Write the modified content back
      fs.writeFileSync(installSectionPath, content, 'utf8');
      console.log('Successfully patched installSection.nsh to show details');
    } else {
      console.log('SetDetailsPrint none not found in installSection.nsh');
    }
  } else {
    console.log('installSection.nsh not found at:', installSectionPath);
  }
}; 