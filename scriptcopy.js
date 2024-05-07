document.addEventListener("DOMContentLoaded", function() {
    let currentHitWidth = 150;  // hitWidthの初期値

    d3.csv("indices.csv", function(d) {
        return {
            date: d.year,  // 年月情報をそのまま使用
            ...Object.keys(d).reduce((acc, key) => {
                if (key !== "year") acc[key] = parseFloat(d[key].replace('%', ''));  // 数値に変換、年以外の列
                return acc;
            }, {})
        };
    }).then(function(data) {
        const items = Object.keys(data[0]).filter(key => key !== "date");

        const margin = {top: 20, right: 20, bottom: 30, left: 50},
            width = 800 - margin.left - margin.right,
            height = 400 - margin.top - margin.bottom;

        const svg = d3.select("#retailprices")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleTime()
            .domain(d3.extent(data, d => new Date(d.date.replace(/年|月/g, '/'))))
            .range([0, width]);

        const xAxis = d3.axisBottom(x)
            .tickFormat(d3.timeFormat("%Y年"));

        const startYear = d3.min(data, d => new Date(d.date.replace(/年|月/g, '/')).getFullYear());
        const endYear = 2024;  // 最終年を明示的に設定
        let tickValues = d3.range(startYear, endYear, 5);  // 5年ごとに値を生成
        tickValues.push(endYear);  // 最終年を追加
            
        xAxis.tickValues(tickValues.map(year => new Date(year, 0, 1)));  // Dateオブジェクトに変換して設定

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis);
        
        const y = d3.scaleLinear()
            .domain([0, 150])  // Y軸の範囲を設定
            .range([height, 0]);

        const yAxis = d3.axisLeft(y)
            .tickSize(-width)  // 目盛り線の長さをグラフの幅と同じにして左方向に引く
            .ticks(10)  // 20単位ごとに目盛りを設定
            .tickPadding(5);
        
        // Y軸を追加
        svg.append("g")
            .call(yAxis)
            .call(g => g.select(".domain").remove())  // Y軸のラインを削除
            .call(g => g.selectAll(".tick line")  // 目盛り線のスタイル設定
                .attr("stroke-opacity", 0.5)  // 目盛り線の透明度調整
                .attr("stroke", "lightgray"))
            .call(g => g.selectAll(".tick line")
                .filter(d => d === 100)  // 目盛り値が100の場合のみ適用
                    .attr("stroke", "darkgray")  // 100の目盛り線の色を黒に設定
                    .attr("stroke-opacity", 1)  // 透明度を完全に不透明に設定
                    .attr("stroke-width", 1.5)) // 線の太さを太くする
            .call(g => g.append("text")  // Y軸のラベル追加
                .attr("y", 10)
                .attr("fill", "currentColor")
                .attr("text-anchor", "start")
                .text("↑ 消費者物価指数（2010年＝100）"));

        const line = d3.line()
            .defined(d => !isNaN(d.value))  // NaNでないデータだけを描画
            .x(d => x(new Date(d.date.replace(/年|月/g, '/'))))  
            .y(d => y(d.value));

        const select = d3.select("#selectItem")
            .on("change", update)
            .selectAll("option")
            .data(items)
            .enter().append("option")
            .text(d => d)
            .attr("value", d => d);

        const tooltip = d3.select("#tooltip");

        // マーカーの初期化
        const marker = svg.append("circle")
        .attr("r", 6) // マーカーの半径
        .attr("class", "marker") // マーカーの色
        .style("display", "none"); // 初期状態では非表示

        svg.on("click", toggleHitWidth);  // SVG全体にクリックイベントを設定



        function update(selectedItem = items[0]) {
            const selected = this.value || selectedItem;

            // 全ての線を通常のスタイルで描画
            const lines = svg.selectAll(".line")
                .data(items)
                .join("path")
                .attr("class", "line")
                .attr("d", item => line(data.map(d => ({date: d.date, value: d[item]})))); 

            // ハイライトされた線を追加し、常に最前面に保持
            svg.selectAll(".selected").remove();  
            const selectedLine = svg.append("path")
                .datum(data.map(d => ({date: d.date, value: d[selected]}))) 
                .attr("class", "selected highlight")
                .attr("d", line);

                // ヒットエリアを追加
            const hitAreas = svg.selectAll(".hit-area")
                .data(items)
                .join("path")
                .attr("class", "hit-area")
                .attr("fill", "none")
                .attr("stroke", "transparent")
                .attr("stroke-width", currentHitWidth)
                .attr("d", item => line(data.map(d => ({date: d.date, value: d[item]}))))
                .on("mousemove", function(event) {
                    const x0 = x.invert(d3.pointer(event, this)[0]);
                    const i = d3.bisector(d => new Date(d.date.replace(/年|月/g, '/'))).left(data, x0, 1);
                    const d0 = data[i - 1];
                    const d1 = data[i];
                    const d = x0 - new Date(d0.date.replace(/年|月/g, '/')) > new Date(d1.date.replace(/年|月/g, '/')) - x0 ? d1 : d0;
                    const markerX = x(new Date(d.date.replace(/年|月/g, '/')));
                    const markerY = y(d[selected]);
                
                    // SVG座標系を画面座標系に変換
                    const svgRect = svg.node().getBoundingClientRect();
                    const tooltipX = svgRect.left + markerX + margin.left;  // SVGの左端とマージンを考慮
                    const tooltipY = svgRect.top + markerY - margin.top;    // SVGの上端とマージンを考慮
                
                    marker.style("display", "block")
                        .attr("cx", markerX)
                        .attr("cy", markerY)
                        .raise();                    

                    tooltip.style("opacity", 1)
                        .html(`${selected}<br>${d.date}<br>${d[selected]}`)
                        .style("left", `${tooltipX - 40}px`)
                        .style("top", `${tooltipY + 30}px`);
                })
                .on("mouseout", function() {
                    tooltip.style("opacity", 0);
                    marker.style("display", "none");
                });
            
            // マーカーを非表示にする
            marker.style("display", "none");

            // selectedLine
            //     .on("mousemove", function(event) {
            //         const x0 = x.invert(d3.pointer(event, this)[0]);
            //         const i = d3.bisector(d => new Date(d.date.replace(/年|月/g, '/'))).left(data, x0, 1);
            //         const d0 = data[i - 1];
            //         const d1 = data[i];
            //         const d = x0 - new Date(d0.date.replace(/年|月/g, '/')) > new Date(d1.date.replace(/年|月/g, '/')) - x0 ? d1 : d0;
            //         marker.style("display", "block")
            //             .attr("cx", x(new Date(d.date.replace(/年|月/g, '/'))))
            //             .attr("cy", y(d[selected]));                    

            //         tooltip.style("opacity", 1)
            //             .html(`${selected}<br>${d.date}<br>${d[selected]}`)
            //             .style("left", `${event.pageX + 18}px`)
            //             .style("top", `${event.pageY + 5}px`);
            //     })

            //     .on("mouseout", function() {
            //         tooltip.style("opacity", 0);
            //         marker.style("display", "none");
            //     });

            // マウスオーバー時のイベント
            lines.on("mouseover", function(event, d) {
                if (d !== selected) {
                    d3.select(this)
                        .classed("temporary-highlight", true)
                        .raise()
                    tooltip.style("opacity", 1)
                           .html(`${d}`)
                           .style("left", (event.pageX + 18) + "px")
                           .style("top", (event.pageY + 5) + "px");
                }
            })
            .on("mouseout", function(d) {
                if (d !== selected) {
                    d3.select(this)
                        .classed("temporary-highlight", false);
                    tooltip.style("opacity", 0);
                }
                selectedLine.raise();
                marker.raise();
                tooltip.raise() // 選択された線を再度最前面に
            });

            // ハイライトされた線用のマウスイベントハンドラを追加
            // selectedLine
            // .on("mouseover", function(event) {
            //     d3.select(this)
            //         .raise(); // 現在の線を前面に移動
            //     tooltip.style("opacity", 1)
            //         .html(`品目: ${selected}<br>年: ${d.date}<br>価格: ${d.value}`)
            //         .style("left", (event.pageX + 18) + "px")
            //         .style("top", (event.pageY + 5) + "px");
            // })
            // .on("mouseout", function() {
            //     tooltip.style("opacity", 0);
            // });
        }        
        update(); // ページ読み込み後に初回更新を実行

    function toggleHitWidth() {
    // 現在のhitWidthが1なら150に、そうでなければ1に切り替える
    currentHitWidth = currentHitWidth === 150 ? 1 : 150;
    console.log("Hit width toggled to:", currentHitWidth);
    update();  // グラフを更新して新しいhitWidthを適用する
    }

    });
});


