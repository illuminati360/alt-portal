import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { CollisionLayer } from '@microsoft/mixed-reality-extension-sdk';

export interface ButtonOptions {
    name?: string,
    boxMeshId: MRE.Guid,
    boxMaterial: MRE.Material,
    boxDimensions: MRE.Vector3Like
    parentId?: MRE.Guid,
    textContent?: string,
    textHeight?: number,
    textColor?: MRE.Color3,
    textAnchor?: MRE.TextAnchorLocation,
    planeMeshId?: MRE.Guid,
    planeMaterial?: MRE.Material,
}

export class Button {
    private _name: string;

    // text
    private _textContent: string;
    private _textHeight: number;
    private _textColor: MRE.Color3;
    private _textAnchor: MRE.TextAnchorLocation;

    // box
    private boxDimensions: MRE.Vector3Like;
    private boxMeshId: MRE.Guid;
    private boxMaterial: MRE.Guid;

    private boxPosition: MRE.Vector3;

    // plane
    private planeMeshId: MRE.Guid;
    private planeMaterial: MRE.Material;

    // actors
    private _box: MRE.Actor;
    private _text: MRE.Actor;
    private _plane: MRE.Actor;

    private buttonBehavior: MRE.ButtonBehavior;

    get box(){
        return this._box;
    }

    get name(){return this._name};

    constructor(context: MRE.Context, options?: ButtonOptions){
        this._name = (options.name !== undefined) ? options.name : 'button';

        this._textContent = (options.textContent !== undefined) ? options.textContent : '';
        this._textColor = (options.textColor !== undefined) ? options.textColor : MRE.Color3.White();
        this._textHeight = (options.textHeight !== undefined) ? options.textHeight : 0.05;
        this._textAnchor = (options.textAnchor !== undefined) ? options.textAnchor : MRE.TextAnchorLocation.MiddleCenter;

        let parentId = (options.parentId !== undefined) ? options.parentId : null;
        this._box = MRE.Actor.Create(context, {
            actor: {
                parentId,
                appearance: {
                    meshId: options.boxMeshId,
                    materialId: options.boxMaterial.id
                },
                collider: { 
                    geometry: { shape: MRE.ColliderType.Auto },
                    layer: CollisionLayer.Hologram
                }
            }
        });

        this._text = MRE.Actor.Create(context, {
			actor: {
                name: 'Text',
                parentId: this._box.id,
				transform: {
					local: { position: {x: 0, y: 0, z: - options.boxDimensions.z - 0.0001} }
				},
				text: {
					contents: this._textContent,
					anchor: this._textAnchor,
                    color: this._textColor,
					height: this._textHeight
				}
			}
        });

        if (this.planeMeshId !== undefined){
            this._plane = MRE.Actor.Create(context, {
                actor: {
                    parentId: this._box.id,
                    appearance: {
                        meshId: this.planeMeshId,
                        materialId: this.planeMaterial.id,
                    },
                    transform: {
                        local: {
                            position: {
                                x: 0,
                                y: 0,
                                z: -this.boxDimensions.z/2 - 0.0001
                            },
                            rotation: MRE.Quaternion.FromEulerAngles(0 * MRE.DegreesToRadians, 0 * MRE.DegreesToRadians, 0 * MRE.DegreesToRadians),
                        }
                    }
                }
            });
        }
    }

    public addButtonBehavior(handler: MRE.ActionHandler<MRE.ButtonEventData>){
        this._box.setBehavior(MRE.ButtonBehavior).onClick(handler);
    }

    public updateButtonText(text: string){
        this._text.text.contents = text;
    }

    public disable(){
        this.box.appearance.enabled = false;
        this.boxPosition = this.box.transform.local.position.clone();
        this.box.transform.local.position.y = -10;
    }

    public enable(){
        this.box.appearance.enabled = true;
        this.box.transform.local.position.y = this.boxPosition.y;
    }
}

export class SephereButton extends Button{
    private spinningTexts: MRE.Actor[];
    private context: MRE.Context;
    private assets: MRE.AssetContainer;

    constructor(context: MRE.Context, assets: MRE.AssetContainer, options?: ButtonOptions){
        let text = options.textContent !== undefined ? options.textContent : '';
        options.textContent = '';
        super(context, options);

        this.context = context;
        this.assets = assets;
        this.createTexts(text, options.boxDimensions.x, options);
        this.animate();
    }

    private createTexts(text: string, radius: number, options: ButtonOptions){
        const TEXT_NUMBER = 3;
        const OUTTER_RADIUS = radius + 0.02;
        for (let i=0; i<TEXT_NUMBER; i++){
            let yRot = i * (360 / TEXT_NUMBER) * MRE.DegreesToRadians; // clockwise. y-rotation is positive
            MRE.Actor.Create(this.context, {
                actor:{ 
                    parentId: this.box.id,
                    transform: { 
                        local: { 
                            position: { x: -OUTTER_RADIUS*Math.sin(yRot), y: 0, z: -OUTTER_RADIUS*Math.cos(yRot) }, // first player on z- axis
                            rotation: MRE.Quaternion.FromEulerAngles(
                                0*MRE.DegreesToRadians,
                                yRot,
                                0*MRE.DegreesToRadians
                            )
                        }
                    },
                    text: {
                        color: (options.textColor !== undefined) ? options.textColor : MRE.Color3.White(),
                        height: (options.textHeight !== undefined) ? options.textHeight : 0.02,
                        contents: text,
                        anchor: (options.textAnchor !== undefined) ? options.textAnchor : MRE.TextAnchorLocation.MiddleCenter
                    }
                },
            });
        }
    }

    private animate(){
        const animDataLike: MRE.AnimationDataLike = { 
            tracks: [
                {
                    target: MRE.ActorPath("ball").transform.local.rotation,
                    easing: MRE.AnimationEaseCurves.Linear,
                    keyframes: [
                        {
                            time: 0,
                            value: MRE.Quaternion.FromEulerAngles(0,0,0)
                        },
                        {
                            time: 3,
                            value: MRE.Quaternion.FromEulerAngles(0,180*MRE.DegreesToRadians,0)
                        },
                        {
                            time: 6,
                            value: MRE.Quaternion.FromEulerAngles(0,360*MRE.DegreesToRadians,0)
                        }
                    ]
                }
            ]
        };
        const animData = this.assets.createAnimationData('spin', animDataLike);
        animData.bind({ ball: this.box }, { 
            isPlaying: true,
            wrapMode: MRE.AnimationWrapMode.Loop
        });
    }
}