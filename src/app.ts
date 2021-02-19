import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { PlanarGridLayout, Quaternion } from '@microsoft/mixed-reality-extension-sdk';
import { AltVRPortalCrawler, PortalItem, PagerItem } from './database';
import { GridMenu, Selector } from './menu';

const MENU_CELL_WIDTH = 0.1;
const MENU_CELL_HEIGHT = 0.05;
const MENU_CELL_DEPTH = 0.02;
const MENU_CELL_MARGIN = MENU_CELL_WIDTH/6;
const MENU_TEXT_HEIGHT = 0.01;

const PORTAL_DIMENSIONS = {width: 1, height: 2, depth: 1};
const PORTAL_MARGIN = 0.1;
const PANEL_DIMENSIONS = {width: 0.8, height: 0.8, depth: 0.01};
const PORTAL_SCALE = 0.2;

const DEBUG = true;

export default class PortalApp {
    private context: MRE.Context;
    private assets: MRE.AssetContainer;
    private baseUrl: string;

    // resources
    public textures: Map<string, MRE.Texture>;
    public prefabs: Map<string, MRE.Prefab>;
    public materials: Map<string, MRE.Material>;
    public sounds: Map<string, MRE.Sound>;

    // actors
    private anchor: MRE.Actor;
    private menuAnchor: MRE.Actor;
    private menu: GridMenu;

    private pagerAnchor: MRE.Actor;
    private pager: Selector;

    private panelBoxMeshId: MRE.Guid;
    private panelPlaneMeshId: MRE.Guid;

    // logic
    private crawler: AltVRPortalCrawler;
    private portals: Portal[] = [];

    private portalGridAnchor: MRE.Actor;
    private portalGrid: PlanarGridLayout;

    // constructor
    constructor(private _context: MRE.Context, private params: MRE.ParameterSet, _baseUrl: string) {
        this.context = _context;
        this.assets = new MRE.AssetContainer(this.context);
        this.baseUrl = _baseUrl;

        this.textures = new Map<string, MRE.Texture>();
        this.prefabs = new Map<string, MRE.Prefab>();
        this.materials = new Map<string, MRE.Material>();
        this.sounds = new Map<string, MRE.Sound>();

        this.panelBoxMeshId = this.assets.createBoxMesh('panel_box', PANEL_DIMENSIONS.width, PANEL_DIMENSIONS.height, PANEL_DIMENSIONS.depth).id;
        this.panelPlaneMeshId = this.assets.createPlaneMesh('panel_plane', PANEL_DIMENSIONS.width, PANEL_DIMENSIONS.height).id;

        this.anchor = MRE.Actor.Create(this.context, {});
        this.portalGridAnchor = MRE.Actor.Create(this.context, {
            actor:{ 
                parentId: this.anchor.id,
                transform: {
                    local: { 
                        position: {
                            x: 0,
                            y: 0,
                            z: PORTAL_MARGIN
                        },
                        rotation: Quaternion.FromEulerAngles(
                            -90*MRE.DegreesToRadians,
                            180*MRE.DegreesToRadians,
                            0
                        ) 
                    }
                }
            },
        });

        this.pagerAnchor = MRE.Actor.Create(this.context, {
            actor:{ 
                parentId: this.anchor.id,
                transform: {
                    local: { 
                        position: {
                            x: 0,
                            y: -MENU_CELL_HEIGHT - MENU_CELL_MARGIN,
                            z: 0
                        }
                    }
                }
            },
        });

        this.crawler = new AltVRPortalCrawler();

        this.context.onStarted(() => this.init());
    }

    private async init(){
        await this.loadMaterials();
        this.createMenu();
    }

    private createMenu(){
        const MENU_ITEMS = ['Search'];

        this.menuAnchor = MRE.Actor.Create(this.context, {
            actor:{ 
                parentId: this.anchor.id
            }
        });
        let boxMeshId = this.assets.createBoxMesh('main_menu_btn_mesh', MENU_CELL_WIDTH, MENU_CELL_HEIGHT, MENU_CELL_DEPTH).id;
        let boxMaterial = this.materials.get('gray');
        let buttonOptions = {
            parentId: this.menuAnchor.id,
            boxMeshId,
            boxMaterial,
            boxDimensions: { x: MENU_CELL_WIDTH, y: MENU_CELL_HEIGHT, z: MENU_CELL_DEPTH },
            textHeight: MENU_TEXT_HEIGHT
        };

        this.menu = new GridMenu(this.context, this.menuAnchor, {
            buttonOptions,
            gridAlignment: MRE.BoxAlignment.MiddleCenter,
            texts: [MENU_ITEMS],
            margins: {x: MENU_CELL_MARGIN, y: MENU_CELL_MARGIN/2}
        });

        this.menu.addButtonBehavior((coord: MRE.Vector2, user: MRE.User)=>{
            let col = coord.y;
            let item = MENU_ITEMS[col];
            switch(item){
                case 'Search':
                    user.prompt("Search Worlds:", true).then(async (dialog) => {
                        if (dialog.submitted) {
                            let text = dialog.text;
                            let result = await this.crawler.searchPortals(text);

                            this.updatePortals(result.items);
                            this.updatePager(result.pager);
                        }
                    });
                    break;
            }
        });
    }

    private updatePortals(portalItems: PortalItem[]){
        const ROW_LENGTH = 6;
        // clear existing portals
        this.portals.forEach(p=>p.remove());
        this.portals = [];

        this.portalGrid = new MRE.PlanarGridLayout(this.portalGridAnchor);
        portalItems.forEach((p,i)=>{
            let uri = p.thumbnailUri;
            let panelOptions = {
                boxMeshId: this.panelBoxMeshId,
                boxMaterial: this.materials.get('gray'),
                planeMeshId: this.panelPlaneMeshId,
                planeMaterial: this.loadMaterial(p.spaceId, uri),
                boxDimensions: PANEL_DIMENSIONS
            };
            let portal = new Portal(this.context, this.assets, this, {
                parentId: this.portalGridAnchor.id,
                panelOptions,
                spaceId: p.spaceId
            });
            this.portals.push(portal);

            this.portalGrid.addCell({
                row: Math.floor(i/ROW_LENGTH),
                column: i%ROW_LENGTH,
                width: (PORTAL_DIMENSIONS.width + PORTAL_MARGIN*2) * PORTAL_SCALE,
                height: (PORTAL_DIMENSIONS.depth + PORTAL_MARGIN*2) * PORTAL_SCALE,
                contents: portal.portal
            });
        });

        this.portalGrid.gridAlignment = MRE.BoxAlignment.TopCenter;
        this.portalGrid.applyLayout();

        this.portals.forEach((p,i)=>{
            let rowNum = Math.floor(this.portals.length/ROW_LENGTH);
            let row = Math.floor(i/ROW_LENGTH);
            p.offset(PANEL_DIMENSIONS.height*(rowNum-row)*PORTAL_SCALE);
        });
    }

    private updatePager(pagerItems: PagerItem[]){
        if (this.pager) {
            this.pager.remove();
        }

        let menuItems = pagerItems.map(p=>p.text);

        let boxMeshId = this.assets.createBoxMesh('main_menu_btn_mesh', MENU_CELL_WIDTH, MENU_CELL_HEIGHT, MENU_CELL_DEPTH).id;
        let boxMaterial = this.materials.get('gray');
        let buttonOptions = {
            parentId: this.pagerAnchor.id,
            boxMeshId,
            boxMaterial,
            boxDimensions: { x: MENU_CELL_WIDTH, y: MENU_CELL_HEIGHT, z: MENU_CELL_DEPTH },
            textHeight: MENU_TEXT_HEIGHT
        };

        this.pager = new Selector(this.context, this.pagerAnchor, {
            buttonOptions,
            gridAlignment: MRE.BoxAlignment.MiddleCenter,
            texts: [menuItems],
            margins: {x: MENU_CELL_MARGIN, y: MENU_CELL_MARGIN/2},
            defaultMaterial: this.materials.get('gray'),
            highlightMaterial: this.materials.get('highlight'),
            toggle: false
        });

        // highlight current page
        let i = pagerItems.findIndex(p=>!p.url);
        this.pager.highlight(new MRE.Vector2(0, i));

        this.pager.addButtonBehavior(async (coord: MRE.Vector2, user: MRE.User)=>{
            let col = coord.y;
            let url = pagerItems[col].url;
            if (url){
                let result = await this.crawler.searchPortals('', url);

                this.updatePortals(result.items);
                this.updatePager(result.pager);
            }
        });
    }

    private async loadMaterials(){
        this.materials.set('trans_red', this.assets.createMaterial('trans_red', { color: MRE.Color4.FromColor3(MRE.Color3.Red(), DEBUG ? 0.3 : 0.0), alphaMode: MRE.AlphaMode.Blend }));
        this.materials.set('trans_gray', this.assets.createMaterial('trans_gray', { color: MRE.Color4.FromColor3(MRE.Color3.Gray(), DEBUG ? 0.3 : 0.0), alphaMode: MRE.AlphaMode.Blend }));
        this.materials.set('invis', this.assets.createMaterial('trans', { color: MRE.Color4.FromColor3(MRE.Color3.Red(), 0.0), alphaMode: MRE.AlphaMode.Blend }));
        this.materials.set('debug', this.assets.createMaterial('debug', { color: MRE.Color4.FromColor3(MRE.Color3.Teal(), 0.3), alphaMode: MRE.AlphaMode.Blend }));
        this.materials.set('highlight', this.assets.createMaterial('debug', { color: MRE.Color4.FromColor3(MRE.Color3.Red(), 0.3), alphaMode: MRE.AlphaMode.Blend }));

        this.materials.set('gray', this.assets.createMaterial('gray', { color: MRE.Color3.Gray() }));
        this.materials.set('white', this.assets.createMaterial('white', { color: MRE.Color3.White() }));
    }

    public loadMaterial(name: string, uri: string){
        let texture;
        if (!this.textures.has('texture_'+name)){
            texture = this.assets.createTexture('texture_'+name, {uri});
            this.textures.set('texture_'+name, texture);
        }else{
            texture = this.textures.get('texture_'+name);
        }

        let material;
        if(!this.materials.has('material_'+name)){
            material = this.assets.createMaterial('material_'+name, { color: MRE.Color3.White(), mainTextureId: texture.id });
            this.materials.set('material_'+name, material);
        }else{
            material = this.materials.get('material_'+name);
        }
        return material;
    }
}

interface PortalOptions {
    parentId: MRE.Guid,
    spaceId: string,
    panelOptions: Partial<PanelOptions>
}

class Portal {
    private context: MRE.Context;
    private assets: MRE.AssetContainer;
    private app: PortalApp;

    private _portal: MRE.Actor;
    private _panel: Panel;

    get portal() { return this._portal };

    constructor(private _context: MRE.Context, private _assets: MRE.AssetContainer, app: PortalApp, options: PortalOptions){
        this.context = _context;
        this.assets = _assets;
        this.app = app;

        this._portal = MRE.Actor.CreateFromLibrary(this.context, {
            resourceId: `teleporter:space/${options.spaceId}?label=true`,
            actor: {
                name: 'portal',
                parentId: options.parentId,
                transform: {
                    local: {
                        position: { 
                            x: 0,
                            y: PORTAL_DIMENSIONS.height/2,
                            z: 0 
                        },
                        rotation: Quaternion.FromEulerAngles(
                            90*MRE.DegreesToRadians,
                            0,
                            0
                        ),
                        scale: {
                            x: PORTAL_SCALE,
                            y: PORTAL_SCALE,
                            z: PORTAL_SCALE,
                        }
                    }
                }
            }
        });

        options.panelOptions.parentId = this._portal.id;
        this._panel = new Panel(this.context, this.assets, options.panelOptions as PanelOptions);
    }

    public offset(zOffset: number){
        this._portal.transform.local.position.z += zOffset;
    }

    public remove(){
        this._portal.destroy();
        this._panel.remove();
    }

}

interface PanelOptions {
    parentId: MRE.Guid,
    boxMeshId: MRE.Guid,
    boxMaterial: MRE.Material,
    planeMeshId: MRE.Guid,
    planeMaterial: MRE.Material,
    boxDimensions: { width: number, height: number, depth: number },
    planeOffset?: number
}

class Panel {
    private context: MRE.Context;
    private assets: MRE.AssetContainer;
    private options: PanelOptions;

    private _plane: MRE.Actor;
    private _box: MRE.Actor;

    get box() {return this._box}
    get plane() {return this._plane}

    constructor(context: MRE.Context, assets: MRE.AssetContainer, options: PanelOptions){
        this.context = context;
        this.assets = assets;
        this.options = options;

        this.init();
    }

    private async init(){
        this._box = MRE.Actor.Create(this.context, {
            actor: {
                parentId: this.options.parentId,
                appearance: {
                    meshId: this.options.boxMeshId,
                    materialId: this.options.boxMaterial.id
                },
                collider: { 
                    geometry: { shape: MRE.ColliderType.Auto },
                    layer: MRE.CollisionLayer.Default
                },
                transform: {
                    local: {
                        position: { x: 0, y: PORTAL_DIMENSIONS.height/2 + PANEL_DIMENSIONS.height*1.5, z: 0 },
                        rotation: Quaternion.FromEulerAngles(
                            0,
                            180*MRE.DegreesToRadians,
                            0
                        )
                    }
                }
            }
        });

        if (this.options.planeMaterial !== undefined){
            this._plane = MRE.Actor.Create(this.context, {
                actor: {
                    parentId: this._box.id,
                    appearance: {
                        meshId: this.options.planeMeshId,
                        materialId: this.options.planeMaterial.id
                    },
                    transform: {
                        local: {
                            position: {
                                x: 0,
                                y: 0,
                                z: -this.options.boxDimensions.depth*0.5 - (this.options.planeOffset !== undefined ? this.options.planeOffset : this.options.boxDimensions.depth*0.1),
                            },
                            rotation: MRE.Quaternion.FromEulerAngles(-90 * MRE.DegreesToRadians, 0 * MRE.DegreesToRadians, 0 * MRE.DegreesToRadians),
                        }
                    }
                }
            });
        }
    }

    public setParent(parentId: MRE.Guid){
        this._box.parentId = parentId;
    }

    public remove(){
        this._box.destroy();
    }
}