const chai = require('chai')
chai.use(require("chai-as-promised"));
const expect = chai.expect;
import * as path from 'path';

import 'mocha';
import { inflateTemplate, exportTemplate, TemplateFile, Template } from '../index';

const mockFs = require('mock-fs');

describe('export', function (this: any) {

    this.timeout(10000);

    afterEach(() => {
        mockFs.restore();
    });

    it("error when template directory not found", async ()  => {

        const testFileContent = "some test content!!";

        mockFs({
            "c:/test": {
                // No sub directories or files.
            },
        });        

        const data = {};
        const options = {
        };

        await expect(inflateTemplate("c:/test/my-template", data, options)).to.be.rejected;
    });

    it('template with no assets directory causes an error', async ()  => {

        const testFileContent = "some test content!!";

        mockFs({
            "c:/test/my-template": {
                // Assets sub-directory.
            },
        });


        const data = {};
        const options = {
        };

        await expect(inflateTemplate("c:/test/my-template", data, options)).to.be.rejected;
    });
    
    it('template with 0 files in assets directory has 0 files', async ()  => {

        const testFileContent = "some test content!!";

        mockFs({
            "c:/test/my-template": {
                "assets": {
                    // No files in template.
                },
            },
        });        

        const data = {};
        const options = {
        };

        const template = await inflateTemplate("c:/test/my-template", data, options);

        expect(template.files.length).to.eql(0);
    });

    it('can inflate one file in memory', async ()  => {

        const testFileContent = "some test content!!";

        mockFs({
            "c:/test/my-template": {
                "assets": {
                    "some-file.txt": testFileContent,
                },
            },
        });        

        const data = {};
        const options = {
        };

        const template = await inflateTemplate("c:/test/my-template", data, options);
        expect(template.files.length).to.eql(1);
        expect(template.files[0].relativePath).to.eql("some-file.txt");
        
        const fileContent = await template.files[0].expand();
        expect(fileContent).to.eql(testFileContent);
    });

    it('can inflate multiple files in memory', async ()  => {

        const testFileContent1 = "test 1";
        const testFileContent2 = "test 2";

        mockFs({
            "c:/test/my-template": {
                "assets": {
                    "some-file-1.txt": testFileContent1,
                    "some-file-2.txt": testFileContent2,
                },
            },
        });        

        const data = {};
        const options = {
        };

        const template = await inflateTemplate("c:/test/my-template", data, options);
        expect(template.files.length).to.eql(2);
        expect(template.files[0].relativePath).to.eql("some-file-1.txt");
        expect(template.files[1].relativePath).to.eql("some-file-2.txt");
        
        const fileContent1 = await template.files[0].expand();
        expect(fileContent1).to.eql(testFileContent1);

        const fileContent2 = await template.files[1].expand();
        expect(fileContent2).to.eql(testFileContent2);
    });
    
    it('can expand a particular named file', async ()  => {

        mockFs({
            "c:/test/my-template": {
                "assets": {
                    "file-1.txt": "f1",
                    "file-2.txt": "f2",
                },
            },
        });        

        const data = {};
        const options = {
        };

        const template = await inflateTemplate("c:/test/my-template", data, options);
        const file = template.find("file-1.txt");
        expect(file).not.to.be.null;
        const expandedContent = await file!.expand();
        expect(expandedContent).to.eql("f1");
    });

    it('finding a non-existing file returns null', async ()  => {

        mockFs({
            "c:/test/my-template": {
                "assets": {
                    "file-1.txt": "f1",
                    "file-2.txt": "f2",
                },
            },
        });        

        const data = {};
        const options = {
        };

        const template = await inflateTemplate("c:/test/my-template", data, options);
        expect(template.find("non-existing-file.txt")).to.be.null;
    });

    it('can inflate nested files in memory', async ()  => {

        const testFileContent = "nested file content";

        mockFs({
            "c:/test/a-template": {
                "assets": {
                    "some-dir": {
                        "some-nested-file.txt": testFileContent,
                    },
                },
            },
        });        

        const data = {};
        const options = {
        };

        const template = await inflateTemplate("c:/test/a-template", data, options);
        expect(template.files.length).to.eql(1);
        expect(template.files[0].relativePath).to.eql("some-dir\\some-nested-file.txt");
        
        const fileContent1 = await template.files[0].expand();
        expect(fileContent1).to.eql(testFileContent);
    });

    it('can expand template', async ()  => {

        const testFileContent = "some {{fooey}} content!!";

        mockFs({
            "c:/test/my-template": {
                "assets": {
                    "some-file.txt": testFileContent,
                },
            },
        });        

        const data = { fooey: 'excellent' };
        const options = {
        };

        const template = await inflateTemplate("c:/test/my-template", data, options);
        expect(template.files.length).to.eql(1);
        const fileContent = await template.files[0].expand();
        expect(fileContent).to.eql("some excellent content!!");
    });

    it('can expand template with template config', async ()  => {

        const testFileContent = "some {{fooey}} content!!";

        mockFs({
            "c:/test/my-template": {
                "template.json": JSON.stringify({}),
                "assets": {
                    "some-file.txt": testFileContent,
                },
            },
        });        

        const data = { fooey: 'excellent' };
        const options = {
        };

        const template = await inflateTemplate("c:/test/my-template", data, options);
        expect(template.files.length).to.eql(1);
        const fileContent = await template.files[0].expand();
        expect(fileContent).to.eql("some excellent content!!");
    });

    it('can request files to not be expanded', async ()  => {

        const testFileContent = "this {{won't}} be expanded!!";

        mockFs({
            "c:/test/my-template": {
                "template.json": JSON.stringify({ noExpand: "_no_expand_/**/*" }),
                "assets": {
                    "_no_expand_": {
                        "some-file.txt": testFileContent,
                    }                    
                },
            },
        });        

        const data = { fooey: 'excellent' };
        const options = {
        };

        const template = await inflateTemplate("c:/test/my-template", data, options);
        expect(template.files.length).to.eql(1);
        const fileContent = await template.files[0].expand();
        expect(fileContent).to.eql(testFileContent);
    });

    it('can request array of files to not be expanded', async ()  => {

        const testFileContent = "this {{won't}} be expanded!!";

        mockFs({
            "c:/test/my-template": {
                "template.json": JSON.stringify({ noExpand: [ "_no_expand1_/**/*", "_no_expand2_/**/*" ] }),
                "assets": {
                    "_no_expand1_": {
                        "some-file.txt": testFileContent,
                    },
                    "_no_expand2_": {
                        "some-file.txt": testFileContent,
                    },
                },
            },
        });        

        const data = {};
        const options = {
        };

        const template = await inflateTemplate("c:/test/my-template", data, options);
        expect(template.files.length).to.eql(2);

        const fileContent1 = await template.files[0].expand();
        expect(fileContent1).to.eql(testFileContent);

        const fileContent2 = await template.files[1].expand();
        expect(fileContent2).to.eql(testFileContent);
    });

    it('error when output to directory that already exists', async ()  => {

        mockFs({
            "c:/test/my-template": {
                "assets": {
                    "some-file.txt": "blah",
                },
            },
            "c:/test/output": { // Output directory already created.
                "some-file.txt": "blah",
            },
        });        

        const data = {};
        const options = {
        };

        await expect(exportTemplate("c:/test/my-template", data, "c:/test/output", options)).to.be.rejected;
    });

    it('can overwrite directory that already exists', async ()  => {

        mockFs({
            "c:/test/my-template": {
                "assets": {
                    "some-file.txt": "blah",
                },
            },
            "c:/test/output": { // Output directory already created.
                "some-file.txt": "blah",
            },
        });        

        const data = {};
        const options = {
            overwrite: true,
        };

        await expect(exportTemplate("c:/test/my-template", data, "c:/test/output", options)).to.be.fulfilled;
    });

    it('can expand in memory file', async ()  => {

        const fileContent = "some-great-content";
        const templateFile = new TemplateFile({}, "c:/test/my-template/some-file.txt", "c:/test/my-template", true, fileContent);
        const expanded = await templateFile.expand();
        expect(expanded).to.eql(fileContent);
    });

    it('can expand in memory file with data', async ()  => {

        const fileContent = "{{some}}";
        const expandedContent = "my-expanded-data";
        const templateFile = new TemplateFile({ some: expandedContent }, "c:/test/my-template/some-file.txt", "c:/test/my-template", true, fileContent);
        const expanded = await templateFile.expand();
        expect(expanded).to.eql(expandedContent);
    });

    it("in memory files are expanded in the template", async () => {

        const fileName = "a file.txt";
        const fileContent = "some-great-content";
        const template = new Template("c:/test/my-template", {}, { 
            inMemoryFiles: [
                {
                    file: fileName,
                    content: fileContent,
                }
            ],
        });

        mockFs({
            "c:/test/my-template": {
                "assets": {
                },
            },
        });
        
        await template.readFiles();
        const templateFile = template.find(fileName)!;
        const expanded = await templateFile.expand();
        expect(expanded).to.eql(fileContent);
    });

    it("in memory file should override on disk file", async () => {

        const fileName = "a file.txt";
        const fileContent = "some-great-content";
        const template = new Template("c:/test/my-template", {}, { 
            inMemoryFiles: [
                {
                    file: fileName,
                    content: fileContent,
                }
            ],
        });

        mockFs({
            "c:/test/my-template": {
                "assets": {
                    "a file.txt": "not-this-content", // File already exists in file system.
                },
            },
        });
        
        await template.readFiles();
        const templateFile = template.find(fileName)!;
        const expanded = await templateFile.expand();
        expect(expanded).to.eql(fileContent);
    });

    it("in memory file should override exported file", async () => {

        const fileName = "a file.txt";
        const fileContent = "some-great-content";
        const exportPort = "c:/test/output";
        const template = new Template("c:/test/my-template", {}, { 
            inMemoryFiles: [
                {
                    file: fileName,
                    content: fileContent,
                }
            ],
        });

        mockFs({
            "c:/test/my-template": {
                "assets": {
                    "a file.txt": "not-this-content", // File already exists in file system.
                },
            },
            "c:/test/output": {

            },
        });

        await template.readFiles();

        expect(template.files.length).to.eql(1);
        expect(await template.files[0].expand()).to.eql(fileContent);
    });
});
