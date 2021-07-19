class Bucket {

    data = new Array();

    add(category) {
        let target = this.data.filter(b => b.category == category);
        if(target.length == 0) {
            this.data.push({
                category,
                value:1
            })
        } else {
            target[0].value++;
        }
    }

    sort(order) {
        order = order == 1 ? 1 : -1;
        return this.data.sort((a, b) => order == 1 ? a.category - b.category : b.category - a.category)
    }

}

module.exports = Bucket;