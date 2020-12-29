import * as MRE from '@microsoft/mixed-reality-extension-sdk';

export default class PortalApp {
    private context: MRE.Context;
    private assets: MRE.AssetContainer;
    private baseUrl: string;

    // resources
    public textures: Map<string, MRE.Texture>;
    public prefabs: Map<string, MRE.Prefab>;
    public materials: Map<string, MRE.Material>;
    public sounds: Map<string, MRE.Sound>;

    // constructor
    constructor(private _context: MRE.Context, private params: MRE.ParameterSet, _baseUrl: string) {
        this.context = _context;
        this.assets = new MRE.AssetContainer(this.context);
        this.baseUrl = _baseUrl;

        this.textures = new Map<string, MRE.Texture>();
        this.prefabs = new Map<string, MRE.Prefab>();
        this.materials = new Map<string, MRE.Material>();
        this.sounds = new Map<string, MRE.Sound>();

        this.context.onStarted(() => this.init());
    }

    private async init(){
        let root = MRE.Actor.Create(this.context, {
            actor:{ 
                grabbable: false,
                transform: { 
                    local: { position: {x: 0, y: 0, z: 0} }
                }
            },
        });
        MRE.Actor.CreateFromLibrary(this.context, {
            resourceId: "teleporter:space/1444446284042731658?label=true",
            actor: {
                name: 'Teleporter to Campfire',
                parentId: root.id,
                transform: {
                    local: {
                        position: { x: 1.2, y: 0.0, z: -0.5 }
                    }
                }
            }
        });
    }
}