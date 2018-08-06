import * as globby from 'globby';
import * as path from 'path';
const promisify = require('promisify-any');
import * as fs from 'fs-extra';
import * as Handlebars from 'handlebars';

/**
 * Represents an expanded file in a template.
 */
export interface ITemplateFile {
    /**
     * Relative path of the file within the tempalte folder..
     */
    relativePath: string;

    /**
     * Expand the files content filling in gaps with data.
     */
    /*async*/ expand(): Promise<string>;

    /**
     * Expand and output the file to the output path.
     * 
     * @param outputPath The path to output the file to.
     */
    /*async*/ export(outputPath: string): Promise<void>;
}

//
// Represents an expanded file in a template.
//
class TemplateFile implements ITemplateFile {

    //
    // Data injected into the template.
    //
    private data: any;

    //
    // Options to configure the template/export. 
    //
    private options: IExportOptions;

    //
    // Full path to the file.
    //
    private fullPath: string;

    /**
     * The name of the file.
     */
    relativePath: string;

    constructor(data: any, options: IExportOptions, filePath: string, templatePath: string) {
        this.data = data;
        this.options = options;
        this.fullPath = filePath;
        this.relativePath = path.relative(templatePath, filePath);
    }

    /**
     * Expand the files content filling in gaps with data.
     */
    async expand(): Promise<string> {
        const templateData = await promisify(fs.readFile)(this.fullPath, 'utf8');
        const expandedTemplate = Handlebars.compile(templateData)(this.data);
        return expandedTemplate;
    }

    /**
     * Expand and output the file to the output path.
     * 
     * @param outputPath The path to output the file to.
     */
    async export(outputPath: string): Promise<void> {
        const expandedContent = this.expand();
        await fs.ensureDir(outputPath);
        await promisify(fs.writeFile)(path.join(outputPath, this.relativePath), expandedContent);
    }
}


/**
 * Represents an inflated template.
 */
export interface ITemplate {
    /**
     * Files contained in the inflated template.
     */
    files: ITemplateFile[];
}

//
// Represents an inflated template.
//
class Template implements ITemplate {
    //
    // Data injected into the template.
    //
    private data: any;

    //
    // Options to configure the template/export. 
    //
    private options: IExportOptions;

    //
    // Files contained in the inflated template.
    //
    files: ITemplateFile[] = [];

    constructor(data: any, options: IExportOptions) {
        this.data = data;
        this.options = options;
    }

    //
    // Read the file system and determine the files in the template.
    //
    async readFiles(): Promise<void> {
        const templateFileWildcard = path.join(this.options.templatePath, "**/*");
        const templateFilePaths = await globby(templateFileWildcard);
        this.files = templateFilePaths
            .map(templateFilePath => 
                new TemplateFile(
                    this.data, 
                    this.options, 
                    templateFilePath,
                    this.options.templatePath,
                )
            );
    }
}

export interface IExportOptions {
    //
    // The path that contains the template to expand.
    //
    templatePath: string;
}

/**
 * Inflate a template in memory.
 * 
 * @param data The data to expand the template.
 * @param options Various options.
 * 
 * @returns An inflated template.
 */
export async function inflateTemplate(data: any, options: IExportOptions): Promise<ITemplate> {
    const template = new Template(data, options);
    await template.readFiles();
    return template;
}

/**
 * Do a full export. Inflate the specified template with data and write all expanded files to the
 * specified output directory.
 * 
 * @param data The data to expand the template.
 * @param outputPath The path to output expanded files to.
 * @param options Various options.
 */
export async function exportTemplate (data: any, outputPath: string, options: IExportOptions): Promise<void> {
    const template = await inflateTemplate(data, options);
    for (const file of template.files) {
        await file.export(outputPath);
    }   
}