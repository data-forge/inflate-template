const chai = require('chai')
chai.use(require("chai-as-promised"));
const expect = chai.expect;
import * as path from 'path';

import 'mocha';
import { inflateTemplate, exportTemplate } from '../index';


const mock = require('mock-fs');

describe('export', () => {

    afterEach(() => {
        mock.restore();
    });

    it("error when template directory not found", async ()  => {

        const testFileContent = "some test content!!";

        mock({
            "c:/test": {
                // No sub directories or files.
            },
        });        

        const data = {};
        const options = {
            templatePath: "c:/test/my-template",
        };

        await expect(inflateTemplate(data, options)).to.be.rejected;
    });
    
    it('can inflate one file in memory', async ()  => {

        const testFileContent = "some test content!!";

        mock({
            "c:/test/my-template": {
                "some-file.txt": testFileContent,
            },
        });        

        const data = {};
        const options = {
            templatePath: "c:/test/my-template",
        };

        const template = await inflateTemplate(data, options);
        expect(template.files.length).to.eql(1);
        expect(template.files[0].relativePath).to.eql("some-file.txt");
        
        const fileContent = await template.files[0].expand();
        expect(fileContent).to.eql(testFileContent);
    });

    it('can inflate multiple files in memory', async ()  => {

        const testFileContent1 = "test 1";
        const testFileContent2 = "test 2";

        mock({
            "c:/test/my-template": {
                "some-file-1.txt": testFileContent1,
                "some-file-2.txt": testFileContent2,
            },
        });        

        const data = {};
        const options = {
            templatePath: "c:/test/my-template",
        };

        const template = await inflateTemplate(data, options);
        expect(template.files.length).to.eql(2);
        expect(template.files[0].relativePath).to.eql("some-file-1.txt");
        expect(template.files[1].relativePath).to.eql("some-file-2.txt");
        
        const fileContent1 = await template.files[0].expand();
        expect(fileContent1).to.eql(testFileContent1);

        const fileContent2 = await template.files[1].expand();
        expect(fileContent2).to.eql(testFileContent2);
    });
    
    it('can expand a particular named file', async ()  => {

        mock({
            "c:/test/my-template": {
                "file-1.txt": "f1",
                "file-2.txt": "f2",
            },
        });        

        const data = {};
        const options = {
            templatePath: "c:/test/my-template",
        };

        const template = await inflateTemplate(data, options);
        const file = template.find("file-1.txt");
        expect(file).not.to.be.null;
        const expandedContent = await file!.expand();
        expect(expandedContent).to.eql("f1");
    });

    it('finding a non-existing file returns null', async ()  => {

        mock({
            "c:/test/my-template": {
                "file-1.txt": "f1",
                "file-2.txt": "f2",
            },
        });        

        const data = {};
        const options = {
            templatePath: "c:/test/my-template",
        };

        const template = await inflateTemplate(data, options);
        expect(template.find("non-existing-file.txt")).to.be.null;
    });

    it('can inflate nested files in memory', async ()  => {

        const testFileContent = "nested file content";

        mock({
            "c:/test/a-template": {
                "some-dir": {
                    "some-nested-file.txt": testFileContent,
                },
            },
        });        

        const data = {};
        const options = {
            templatePath: "c:/test/a-template",
        };

        const template = await inflateTemplate(data, options);
        expect(template.files.length).to.eql(1);
        expect(template.files[0].relativePath).to.eql("some-dir\\some-nested-file.txt");
        
        const fileContent1 = await template.files[0].expand();
        expect(fileContent1).to.eql(testFileContent);
    });

    it('can expand template', async ()  => {

        const testFileContent = "some {{fooey}} content!!";

        mock({
            "c:/test/my-template": {
                "some-file.txt": testFileContent,
            },
        });        

        const data = { fooey: 'excellent' };
        const options = {
            templatePath: "c:/test/my-template",
        };

        const template = await inflateTemplate(data, options);
        expect(template.files.length).to.eql(1);
        const fileContent = await template.files[0].expand();
        expect(fileContent).to.eql("some excellent content!!");
    });

    it('error when output to directory that already exists', async ()  => {

        mock({
            "c:/test/my-template": {
                "some-file.txt": "blah",
            },
            "c:/test/output": { // Output directory already created.
                "some-file.txt": "blah",
            },
        });        

        const data = {};
        const options = {
            templatePath: "c:/test/my-template",
        };

        await expect(exportTemplate(data, "c:/test/output", options)).to.be.rejected;
    });

    it('can overwrite directory that already exists', async ()  => {

        mock({ //TODO: I should do I my pull request on mock that allows me to spy on the function. I could then test this module more fully.
            "c:/test/my-template": {
                "some-file.txt": "blah",
            },
            "c:/test/output": { // Output directory already created.
                "some-file.txt": "blah",
            },
        });        

        const data = {};
        const options = {
            templatePath: "c:/test/my-template",
            overwrite: true,
        };

        await expect(exportTemplate(data, "c:/test/output", options)).to.be.fulfilled;
    });
});
