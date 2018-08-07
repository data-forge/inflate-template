import * as globby from 'globby';
import * as path from 'path';
const promisify = require('promisify-any');
import * as fs from 'fs-extra';
import * as Handlebars from 'handlebars';
import { assert } from 'chai';

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
        const expandedContent = await this.expand();
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

    /**
     * Finds a file by name and returns it.
     * Returns null if the file doesn't exist.
     * 
     * @param fileName Name of the file to find.
     */
    find(fileName: string): ITemplateFile | null;
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
        const exists = await fs.pathExistsSync(this.options.templatePath);
        if (!exists) {
            throw new Error("Template path '" + this.options.templatePath + "' does not exist.");
        }
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

    /**
     * Finds a file by name and returns it.
     * Returns null if the file doesn't exist.
     * 
     * @param fileName Name of the file to find.
     */
    find(fileName: string): ITemplateFile | null {
        for (const file of this.files) {
            if (file.relativePath === fileName) {
                return file;
            }
        }

        return null;
    }
}

/**
 * Options for exporting a template.
 */
export interface IExportOptions {
    /***
     * The path that contains the template to expand.
     */
    templatePath: string;

    /**
     * Set to true to allow the output path to be overwritten.
     * Defaults to false.
     */
    overwrite?: boolean;
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
    const exists = await fs.pathExists(outputPath);
    if (exists) {
        if (options.overwrite) {
            await fs.remove(outputPath);
        }
        else {
            throw new Error("Output path '" + outputPath + "' already exists.");
        }
    }

    await fs.ensureDir(outputPath);
    
    const template = await inflateTemplate(data, options);
    for (const file of template.files) {
        await file.export(outputPath);
    }   
}

//
// Basic test run using the real file system.
//
async function testRun(): Promise<void> {
    await exportTemplate(
        { 
            msg: "Hello computer" 
        }, 
        "test-output", 
        { 
            templatePath: "test-template",
            overwrite: true,
        }
    );

    const file1 = await promisify(fs.readFile)(path.join("test-output", "test1.txt"), "utf8");
    assert(file1 === "MSG: Hello computer", "file1");

    const file2 = await promisify(fs.readFile)(path.join("test-output", "test2.html"), "utf8");
    const expectedContent = "<html>\r\n    <body>\r\n        Hello computer\r\n    </body>\r\n</html>";
    assert(file2 === expectedContent, "file2");
}

if (require.main === module) { // For command line testing.
    testRun()
        .then(() => console.log("Done"))
        .catch(err => console.error(err && err.stack || err));
}
   
 