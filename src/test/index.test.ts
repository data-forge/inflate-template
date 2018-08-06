import { assert, expect } from 'chai';
import 'mocha';
import { inflateTemplate, exportTemplate } from '../index';

const mock = require('mock-fs');

//test:
//  - can expand single file
//  - can expand multiple files
//  - can expand files in nested sub-dir
//  - can expand files in memory only

describe('export', () => {

    afterEach(() => {
        mock.restore();
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
});
