import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { Vector2 } from '@microsoft/mixed-reality-extension-sdk';
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
    private buttons: Map<string, Button>;

    private root: MRE.Actor;

    private size: MRE.Vector2;

    constructor(context: MRE.Context, root: MRE.Actor, options: menuOptions){
        this.menuGrid = new MRE.PlanarGridLayout(root);
        this.buttons = new Map<string, Button>();
        this.root = root;

        let texts = options.texts;
        this.size = new MRE.Vector2();
        this.size.x = texts.length;
        this.size.y = texts[0].length;

        this.buttons = new Map<string, Button>();

        let buttonOptions = options.buttonOptions;
        for (let r=0; r<texts.length; r++){
            let row = texts[r];
            for (let c=0; c<row.length; c++){
                let d = texts[r][c];
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
            for (let c=0; c<this.size.y; c++){
                let button = this.buttons.get(`${r},${c}`);
                button.addButtonBehavior((user,_) => {
                    onButtonClick(new Vector2(r, c), user);
                })
            }
        }
    }

    public disable(){
        this.root.appearance.enabled = false;
        this.root.transform.local.position.z = -10;
    }

    public enable(){
        this.root.appearance.enabled = true;
        this.root.transform.local.position.z = 0;
    }

    public showItems(items: string[]){
        this.enable();
        this.buttons.forEach(b=>{
            b.box.appearance.enabled = items.includes(b.name) ? true : false;
        });
    }

    public getMenuDimensions(){
        return {width: this.menuGrid.getGridWidth(), height: this.menuGrid.getGridHeight()};
    }

    public getBoxAt(coord: Vector2){
        return this.buttons.get(`${coord.x},${coord.y}`).box;
    }

    public updateTextAt(coord: Vector2, text: string){
        this.buttons.get(`${coord.x},${coord.y}`).updateButtonText(text);
    }
}

export class NumberInput extends GridMenu{
    public min: number;
    public max: number;
    public value: number;

    public updateValueText(){
        this.updateTextAt(new Vector2(0,1), this.value.toString());
    }
}

export class Selector extends GridMenu{
    public coord: Vector2;
    public value: number;
}