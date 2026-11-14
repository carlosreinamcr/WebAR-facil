/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/// <reference types="@webgpu/types" preserve="true" />
export * from './core';
export { ThreeARGroup } from './wrappers/ThreeARGroup';
export { ThreeARModel } from './wrappers/ThreeARModel';
export type { ARModelOptions,ARModelLoadOptions,ARAnimationOptions } from './wrappers/ThreeARModel';
export {ThreeARVideo} from './wrappers/ThreeARVideo';
export type {ARVideoOptions,ChromaKeyOptions} from './wrappers/ThreeARVideo';
export {ThreeARScene} from './wrappers/ThreeARScene';
export type {ARSceneOptions} from './wrappers/ThreeARScene';
export { ThreeCameraBackground } from './wrappers/ThreeCameraBackground';
export { registerAFrameComponent } from './wrappers/aframe-component';
export { registerAFrameModelComponent } from './wrappers/aframe-model';
export {registerAFrameVideoComponent} from './wrappers/aframe-video';
export {registerARComponents} from './wrappers/web-components';
export type {ARComponentsOptions,ARSceneElement,ARModelElement,ARVideoElement} from './wrappers/web-components';
export type {PlacementState} from './wrappers/SurfacePlacement';
