import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { Button, ButtonOptions } from './button';

interface menuOptions {
    buttonOptions: ButtonOptions,
    texts: string[][],
    materials?: MRE.Material[][],
    margins: {
        x: number,
        y: number
    },
    gridAlignment?: MRE.BoxAlignment
}

export class GridMenu {
    private menuGrid: MRE.PlanarGridLayout;
    protected buttons: Map<string, Button>;
    protected texts: string[][];

    private root: MRE.Actor;

    private size: MRE.Vector2;

    private owner: MRE.User;

    constructor(context: MRE.Context, root: MRE.Actor, options: menuOptions){
        this.menuGrid = new MRE.PlanarGridLayout(root);
        this.buttons = new Map<string, Button>();
        this.root = root;

        this.texts = options.texts;
        this.size = new MRE.Vector2();
        this.size.x = this.texts.length;
        this.size.y = this.texts[0].length;

        this.buttons = new Map<string, Button>();

        let buttonOptions = options.buttonOptions;
        for (let r=0; r<this.texts.length; r++){
            let row = this.texts[r];
            for (let c=0; c<row.length; c++){
                let d = this.texts[r][c];
                buttonOptions.name = d;
                buttonOptions.textContent = d;

                if (options.materials !== undefined){
                    buttonOptions.boxMaterial = options.materials[r][c];
                }
                let button = new Button(context, buttonOptions);

                this.menuGrid.addCell({
                    row: r,
                    column: c,
                    width: buttonOptions.boxDimensions.x + options.margins.x*2,
                    height: buttonOptions.boxDimensions.y + options.margins.y*2,
                    contents: button.box
                });

                let coord = `${r},${c}`;
                this.buttons.set(coord, button);
            }
        }

        this.menuGrid.gridAlignment = (options.gridAlignment !== undefined) ? options.gridAlignment : MRE.BoxAlignment.MiddleCenter;
        this.menuGrid.applyLayout();
    }

    public addButtonBehavior(onButtonClick: (coord: MRE.Vector2, user: MRE.User) => void){
        for (let r=0; r<this.size.x; r++){
            for (let c=0; c<this.texts[r].length; c++){
                let button = this.buttons.get(`${r},${c}`);
                button.addButtonBehavior((user,_) => {
                    if (!this.owner || this.owner.id == user.id){
                        onButtonClick(new MRE.Vector2(r, c), user);
                    }
                })
            }
        }
    }

    public disable(){
        this.root.appearance.enabled = false;
        this.buttons.forEach(button=>button.disable());
    }

    public enable(){
        this.root.appearance.enabled = true;
        this.buttons.forEach(button=>button.enable());
    }

    public getMenuDimensions(){
        return {width: this.menuGrid.getGridWidth(), height: this.menuGrid.getGridHeight()};
    }

    public getBoxAt(coord: MRE.Vector2){
        return this.buttons.get(`${coord.x},${coord.y}`).box;
    }

    public updateTextAt(coord: MRE.Vector2, text: string){
        this.buttons.get(`${coord.x},${coord.y}`).updateButtonText(text);
    }

    public setOwner(user: MRE.User){
        this.owner = user;
    }

    public clearOwner(){
        this.owner = null;
    }

    public remove(){
        this.buttons.forEach(b=>b.box.destroy());
    }
}

export class NumberInput extends GridMenu{
    public min: number;
    public max: number;
    public value: string;

    public updateValueText(){
        this.updateTextAt(new MRE.Vector2(0,1), this.value.toString());
    }
}

export interface SelectorOptions extends menuOptions{
    defaultMaterial: MRE.Material,
    highlightMaterial: MRE.Material,
    toggle?: boolean
}

export class Selector extends GridMenu{
    public coord: MRE.Vector2;
    public value: string;

    private defaultMaterial: MRE.Material;
    private highlightMaterial: MRE.Material;
    private toggle: boolean;

    constructor(context: MRE.Context, root: MRE.Actor, options: SelectorOptions){
        super(context, root, options);
        this.defaultMaterial = options.defaultMaterial;
        this.highlightMaterial = options.highlightMaterial;
        this.toggle = options.toggle !== undefined ? options.toggle : true;
    }

    private vecToStr(coord: MRE.Vector2){
        return `${coord.x},${coord.y}`;
    }

    public highlightValue(value: string){
        for(let i=0; i<this.texts.length; i++){
            let r = this.texts[i];
            for (let j=0; j<r.length; j++){
                if (r[j] == value){
                    this.highlight(new MRE.Vector2(i,j));
                }
            }
        }
    }

    public highlight(coord: MRE.Vector2){
        // click on highlight or not
        if (this.toggle && this.coord != null && this.coord.equals(coord)){
            this.buttons.get(this.vecToStr(coord)).box.appearance.material = this.defaultMaterial;
            this.coord = null;
        }else{
            if (this.coord != null){
                this.buttons.get(this.vecToStr(this.coord)).box.appearance.material = this.defaultMaterial;
            }
            this.buttons.get(this.vecToStr(coord)).box.appearance.material = this.highlightMaterial;
            this.coord = coord;
        }

        if (this.coord != null){
            this.value = this.texts[coord.x][coord.y];
        }else{
            this.value = null;
        }
    }
}