const defaults={internetPermission:false,fileAccessPermission:false,notificationsPermission:false,externalProviderPermission:false,externalServicesPermission:false,desktopAutomationPermission:false};
function normalize(value={}){return Object.fromEntries(Object.keys(defaults).map(k=>[k,typeof value[k]==='boolean'?value[k]:defaults[k]]));}
function requirePermission(permissions,key){if(!normalize(permissions)[key])throw new Error(`Permission denied: ${key}`);return true;}
module.exports={defaults,normalize,requirePermission};
