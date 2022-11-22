import * as d3 from "d3";

describe("d3.bisect", () => {
    //             0  1   2   3   4   5
    const input = [1, 6, 10, 13, 17, 18];
    const bisect = d3.bisector((el: number) => el);

    it("finds existing elements", () => {
        expect(bisect.left(input, 6)).toEqual(1);
        expect(bisect.center(input, 6)).toEqual(1);
        expect(bisect.right(input, 6)).toEqual(2);
    });

    it("finds the right place if the element doesn't exist", () => {
        expect(bisect.left(input, 12)).toEqual(3);
        expect(bisect.center(input, 12)).toEqual(3);
        expect(bisect.right(input, 12)).toEqual(3);
    });

    it("finds the right place if the element doesn't exist", () => {
        expect(bisect.left(input, 19)).toEqual(6);
        expect(bisect.center(input, 19)).toEqual(5);
        expect(bisect.right(input, 19)).toEqual(6);
    });
});
