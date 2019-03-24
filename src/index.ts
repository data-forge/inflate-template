import * as globby from 'globby';
import * as path from 'path';
const promisify = require('promisify-any');
import * as fs from 'fs-extra';
import * as Handlebars from 'handlebars';
import { assert } from 'chai';
import { argv } from 'yargs';

Handlebars.registerHelper('json', context => {
    return JSON.stringify(context, null, 4);
});

/**
 * Represents an expanded file in a template.
 */
export interface ITemplateFile {
    /**
     * Relative path of the file within the template folder.
     */
    readonly relativePath: string;

    /**
     * Get the pull path of the template file in the template assets directory.
     */
    getFullPath(): string;

    /**
     * Expand the files content filling in gaps with data.
     */
    expand(): Promise<string>;

    /**
     * Expand and output the file to the output path.
     * 
     * @param outputPath The path to output the file to.
     */
    export(outputPath: string): Promise<void>;
}

//
// Represents an expanded file in a template.
//
export class TemplateFile implements ITemplateFile {

    //
    // Set to true to expand the template file.
    //
    private allowExpand: boolean;

    //
    // Data injected into the template.
    //
    private data: any;

    //
    // The directory that contains the template files.
    //
    private templateAssetsPath: string;

    //
    // Content from the file once it has been loaded into memory.
    //
    private fileContent?: string;

    //
    // Expanded content afer it has been cached.
    //
    private expandedContent?: string;

    /**
     * The name of the file.
     */
    readonly relativePath: string;

    constructor(data: any, relativeFilePath: string, templateAssetsPath: string, allowExpand: boolean, fileContent?: string) {
        this.data = data;
        this.relativePath = relativeFilePath;
        this.templateAssetsPath = templateAssetsPath;
        this.allowExpand = allowExpand;
        this.fileContent = fileContent;
    }

    /**
     * Get the pull path of the template file in the template assets directory.
     */
    getFullPath(): string {
        return path.join(this.templateAssetsPath, this.relativePath);
    }
    
    //
    // Load the file's content into memory (if not already loaded).
    //
    private async loadContent(): Promise<string> {
        if (this.fileContent) {
            // Already loaded.
            return this.fileContent;
        }

        this.fileContent = await promisify(fs.readFile)(this.getFullPath(), 'utf8');
        return this.fileContent!;
    }

    /**
     * Expand the files content filling in gaps with data.
     */
    async expand(): Promise<string> {
        if (this.expandedContent) {
            // Content already expanded.
            return this.expandedContent; 
        }

        const fileContent = await this.loadContent();
        if (this.allowExpand) {
            try {
                this.expandedContent = Handlebars.compile(fileContent)(this.data);
            }
            catch (err) {
                throw new Error("Error compiling template file '" + this.getFullPath() + "'.\r\n" + (err && err.stack || err));
            }
        }
        else {
            this.expandedContent = fileContent;
        }

        return this.expandedContent;
    }

    /**
     * Expand and output the file to the output path.
     * 
     * @param outputPath The path to output the file to.
     */
    async export(outputPath: string): Promise<void> {
        const expandedContent = await this.expand();
        const fullOutputPath = path.join(outputPath, this.relativePath);
        await fs.ensureDir(path.dirname(fullOutputPath));
        await promisify(fs.writeFile)(fullOutputPath, expandedContent);
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
export class Template implements ITemplate {
    
    //
    // The path from which to read template files.
    //
    private templatePath: string;

    //
    // Data injected into the template.
    //
    private data: any;

    //
    // Options to configure the template. 
    //
    private options?: IInflateOptions;

    //
    // Files contained in the inflated template.
    //
    files: ITemplateFile[] = [];

    constructor(templatePath: string, data: any, options?: IInflateOptions) {
        this.templatePath = templatePath;
        this.data = data;
        this.options = options;
    }

    //
    // Inflate files provided in memory.
    //
    private inflateInMemoryFiles(templateAssetsDirectoryPath: string): ITemplateFile[] {
        return this.options && this.options.inMemoryFiles 
            ? this.options.inMemoryFiles.map(inMemoryFile => 
                new TemplateFile(
                    this.data,
                    inMemoryFile.file,
                    templateAssetsDirectoryPath,
                    true,
                    inMemoryFile.content
                )
            )
            : []
            ;
    }

    //
    // Read the file system and determine the files in the template.
    //
    async readFiles(): Promise<void> {
        const templateDirectoryExists = await fs.pathExists(this.templatePath);
        if (!templateDirectoryExists) {
            throw new Error("Template path '" + this.templatePath + "' does not exist.");
        }

        const assetsDirectoryName = "assets";
        const templateAssetsDirectoryPath = path.join(this.templatePath, assetsDirectoryName);
        const templateAssetsDirectoryExists = await fs.pathExists(templateAssetsDirectoryPath);
        if (!templateAssetsDirectoryExists) {
            throw new Error("Expected template in '" + this.templatePath + "' to contain an '" + assetsDirectoryName + "' sub-directory that contains the templates files to be inflated..");
        }

        const templateConfigFilePath = path.join(this.templatePath, "template.json");
        const templateConfigFileExists = await fs.pathExists(templateConfigFilePath);
        let noExpandWildcard: string[];
        if (templateConfigFileExists) {
            const templateConfigContent = await promisify(fs.readFile)(templateConfigFilePath, "utf8");
            const templateConfig = JSON.parse(templateConfigContent);
            if (templateConfig.noExpand) {
                if (Array.isArray(templateConfig.noExpand)) {
                    noExpandWildcard = templateConfig.noExpand;
                }
                else {
                    noExpandWildcard = [ templateConfig.noExpand ];
                }
            }
            else {
                noExpandWildcard = [];    
            }
        }
        else {
            noExpandWildcard = [];
        }

        const templateFileWildcard = path.join(templateAssetsDirectoryPath, "**/*");
        const noExpandFileWildcards = noExpandWildcard
            .map(wildcard => 
                path.join(templateAssetsDirectoryPath, wildcard)
            );
        const templateFileWildcards = [ templateFileWildcard ]
            .concat(noExpandFileWildcards
                .map(wildcard => "!" + wildcard)
            );
        const filesToInflate = await globby(templateFileWildcards);
        const otherFiles = await globby(noExpandFileWildcards)
        this.files = this.inflateInMemoryFiles(templateAssetsDirectoryPath)
            .concat(
                filesToInflate.map(templateFilePath =>  //TODO: Only load files from disk when not already loaded from memory.
                    new TemplateFile(
                        this.data, 
                        path.relative(templateAssetsDirectoryPath, templateFilePath),
                        templateAssetsDirectoryPath,
                        true
                    )
                )
            )
            .concat(
                otherFiles.map(noExpandFilePath => 
                    new TemplateFile(
                        this.data, 
                        path.relative(templateAssetsDirectoryPath, noExpandFilePath),
                        templateAssetsDirectoryPath,
                        false
                    )
                )
            );
    }

    /**
     * Finds a file by name and returns it.
     * Returns null if the file doesn't exist.
     * 
     * @param fileName Name of the file to find.
     */
    find(fileName: string): ITemplateFile | null { //TODO: Optimize this lookup!
        for (const file of this.files) {
            if (file.relativePath === fileName) {
                return file;
            }
        }

        return null;
    }
}

/**
 * A file whose content is already loaded in memory.
 */
export interface IInMemoryFile {
    /**
     * The name of the file.
     */
    file: string;

    /**
     * The content of the file.
     */
    content: string;
}

/**
 * Options for inflating a template.
 */
export interface IInflateOptions {

    /**
     * Files that are already loaded into memory.
     */
    inMemoryFiles?: IInMemoryFile[];
}

/**
 * Options for exporting a template.
 */
export interface IExportOptions extends IInflateOptions {

    /**
     * Set to true to clean the existing export directory before writting the new one.
     */
    clean?: boolean;

    /**
     * Set to true to allow the output path to be overwritten.
     * Defaults to false.
     */
    overwrite?: boolean;
}

/**
 * Inflate a template in memory.
 * 
 * @param templatePath The path to load the template from.
 * @param data The data to expand the template.
 * @param options Various options.
 * 
 * @returns An inflated template.
 */
export async function inflateTemplate(templatePath: string, data: any, options?: IInflateOptions): Promise<ITemplate> {
    const template = new Template(templatePath, data, options);
    await template.readFiles();
    return template;
}

/**
 * Do a full export. Inflate the specified template with data and write all expanded files to the
 * specified output directory.
 * 
 * @param templatePath The path to load the template from.
 * @param data The data to expand the template.
 * @param outputPath The path to output expanded files to.
 * @param options Various options.
 */
export async function exportTemplate (templatePath: string, data: any, outputPath: string, options?: IExportOptions): Promise<void> {
    const exists = await fs.pathExists(outputPath);
    if (exists) {
        if (options && options.overwrite) {
            if (options.clean) {
                await fs.remove(outputPath); // Overwrite and clean.
            }
        }
        else {
            throw new Error("Output path '" + outputPath + "' already exists."); // Export already exists.
        }
    }

    await fs.ensureDir(outputPath);
    
    const template = await inflateTemplate(templatePath, data, options);
    for (const file of template.files) {
        await file.export(outputPath);
    }   
}

// 
// Load test data from the template directory.
//
async function loadTestData(templatePath: string): Promise<any> { 
    const testDataFilePath = path.join(templatePath, "test-data.json");
    const testDataExists = await fs.pathExists(testDataFilePath);
    if (!testDataExists) {
        throw new Error("To test your template you need a test-data.json in your template directory.");
    }

    const testDataFileContent = await promisify(fs.readFile)(testDataFilePath, "utf8");
    const testData = JSON.parse(testDataFileContent);
    return testData;
}

//
// Command line inflate and export a template.
//
async function cli_export(templatePath: string, outputPath: string, overwrite: boolean): Promise<void> {
    const testData = await loadTestData(templatePath);
    await exportTemplate(
        templatePath,
        testData, 
        outputPath, 
        {
            overwrite: overwrite,
        }
    );
}

//
// Basic test run using the real file system.
//
async function testRun(): Promise<void> {
    await exportTemplate(
        "test-template",
        { 
            msg: "Hello computer" 
        }, 
        "test-output", 
        { 
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
    if (argv._.length === 0) {
        throw new Error("Expected a command of export");
    }

    const cmd = argv._[0];
    if (cmd === "test") {
        console.log("Test run...");
        testRun()
            .then(() => console.log("Done"))
            .catch(err => console.error(err && err.stack || err));
    }
    else if (cmd === "export") {
        if (!argv.template) {
            throw new Error("Expected argument --template=<path-to-your-template>");
        }

        if (!argv.out) {
            throw new Error("Expected argument --out=<path-to-output-expanded-template>");
        }

        cli_export(argv.template, argv.out, !!argv.overwrite)
            .catch(err => console.error(err && err.stack || err));
    }
    else {
        throw new Error("Unknown command: " + cmd);
    }
}
   
 
 