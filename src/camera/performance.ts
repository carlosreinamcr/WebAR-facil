/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/** Presupuestos de trabajo, no clasificaciones de marcas/modelos de teléfono. */
const profiles={
  auto:{width:960,height:540,fps:30,maxFrameWidth:640,maxFramePixels:307200},
  balanced:{width:1280,height:720,fps:30,maxFrameWidth:640,maxFramePixels:307200},
  battery:{width:640,height:480,fps:20,maxFrameWidth:480,maxFramePixels:172800},
  quality:{width:1920,height:1080,fps:30,maxFrameWidth:960,maxFramePixels:921600},
} as const;

export function cameraProfile(name:string='auto'){
  if(!Object.hasOwn(profiles,name))throw new Error('performance debe ser auto, balanced, battery o quality.');
  return profiles[name as keyof typeof profiles];
}
